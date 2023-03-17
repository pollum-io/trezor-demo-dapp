import * as ethUtil from '@ethereumjs/util';
import { Buffer } from 'buffer';
import HDKey from 'hdkey';
import TrezorConnect, {
  Device,
  DeviceEventMessage,
  DEVICE_EVENT,
} from '@trezor/connect-web';
import { transformTypedData } from '@trezor/connect-plugin-ethereum';
import {
  TypedMessage,
  SignTypedDataVersion,
  MessageTypes,
} from '@metamask/eth-sig-util';
import { hasProperty } from '@metamask/utils';

const hdPathString = `m/44'/60'/0'/0/0`;
const pathBase = 'm';
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
const TREZOR_CONNECT_MANIFEST = {
  appUrl: 'https://paliwallet.com/',
  email: 'pali@pollum.io',
};

export interface TrezorControllerOptions {
  hdPath?: string;
  perPage?: number;
  setIsLoading?: () => void;
}

export interface TrezorControllerState {
  hdPath: string;
  paths: Record<string, number>;
  perPage: number;
  unlockedAccount: number;
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a Trezor Device Event Message is
 * an event message with `event.payload` as Device
 * and with property `features`
 *
 * @param event Trezor device event message
 * @returns
 */
function hasDevicePayload(
  event: DeviceEventMessage
): event is DeviceEventMessage & { payload: Device } {
  return hasProperty(event.payload, 'features');
}

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    TrezorConnect: any;
  }
}

export class TrezorKeyring {
  hdk: HDKey = new HDKey();
  setIsLoading: (isLoading: boolean) => void;
  hdPath: string = hdPathString;
  publicKey: string;
  chainCode: string;
  paths: Record<string, number> = {};
  model?: string;

  constructor(opts: TrezorControllerOptions = {}) {
    this.deserialize(opts);

    TrezorConnect.on(DEVICE_EVENT, (event) => {
      if (hasDevicePayload(event)) {
        this.model = event.payload.features?.model;
      }
    });
  }

  async initialize({ coin, slip44 }: { coin: string; slip44: string }) {
    this.setIsLoading(true);

    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'`;
        break;

      default:
        this.hdPath = `m/44'/${slip44}'/0'/0/0`;
        break;
    }

    window.TrezorConnect = TrezorConnect;

    try {
      await TrezorConnect.dispose();

      await TrezorConnect.init({
        manifest: TREZOR_CONNECT_MANIFEST,
      });

      const address = await TrezorConnect.getAccountInfo({
        coin,
        path: this.hdPath,
      });

      this.setIsLoading(false);

      return address.payload;
    } catch (error) {
      this.setIsLoading(false);
      alert(error);
    }
  }

  /**
   * Gets the model, if known.
   * This may be `undefined` if the model hasn't been loaded yet.
   *
   * @returns
   */
  getModel(): string | undefined {
    return this.model;
  }

  dispose() {
    // This removes the Trezor Connect iframe from the DOM
    // This method is not well documented, but the code it calls can be seen
    // here: https://github.com/trezor/connect/blob/dec4a56af8a65a6059fb5f63fa3c6690d2c37e00/src/js/iframe/builder.js#L181
    TrezorConnect.dispose();
  }

  async getEthereumPublicKey() {
    try {
      const walletInfo = await TrezorConnect.ethereumGetPublicKey({
        path: this.hdPath,
        showOnTrezor: true,
      });

      return walletInfo;
    } catch (error) {
      return error;
    }
  }

  async deserialize(opts: TrezorControllerOptions = {}) {
    this.hdPath = opts.hdPath ?? hdPathString;
    this.setIsLoading = opts.setIsLoading;
    return Promise.resolve();
  }

  async unlock() {
    return new Promise((resolve, reject) => {
      TrezorConnect.getPublicKey({
        path: this.hdPath,
        coin: 'ETH',
      })
        .then((response) => {
          if (response.success) {
            this.hdk.publicKey = Buffer.from(response.payload.publicKey, 'hex');
            this.hdk.chainCode = Buffer.from(response.payload.chainCode, 'hex');
            resolve('just unlocked');
          } else {
            // @ts-ignore
            reject(new Error(response.payload?.error || 'Unknown error'));
          }
        })
        .catch((e) => {
          reject(new Error(e?.toString() || 'Unknown error'));
        });
    });
  }

  async signMessage(withAccount: string, data: string) {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(withAccount: string, message: string) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        TrezorConnect.ethereumSignMessage({
          path: this.#pathFromAddress(withAccount),
          message: ethUtil.stripHexPrefix(message),
          hex: true,
        })
          .then((response) => {
            if (response.success) {
              if (
                response.payload.address !==
                ethUtil.toChecksumAddress(withAccount)
              ) {
                reject(new Error('signature doesnt match the right address'));
              }
              const signature = `0x${response.payload.signature}`;
              resolve(signature);
            } else {
              reject(
                // @ts-ignore
                new Error(response.payload?.error || 'Unknown error')
              );
            }
          })
          .catch((e) => {
            reject(new Error(e?.toString() || 'Unknown error'));
          });
        // This is necessary to avoid popup collision
        // between the unlock & sign trezor popups
      }, DELAY_BETWEEN_POPUPS);
    });
  }

  /**
   * EIP-712 Sign Typed Data
   */
  async signTypedData<T extends MessageTypes>(
    address: string,
    data: TypedMessage<T>,
    { version }: { version: SignTypedDataVersion }
  ) {
    const dataWithHashes = transformTypedData(data, version === 'V4');

    // set default values for signTypedData
    // Trezor is stricter than @metamask/eth-sig-util in what it accepts
    const {
      types,
      message = {},
      domain = {},
      primaryType,
      // snake_case since Trezor uses Protobuf naming conventions here
      domain_separator_hash, // eslint-disable-line camelcase
      message_hash, // eslint-disable-line camelcase
    } = dataWithHashes;

    // This is necessary to avoid popup collision
    // between the unlock & sign trezor popups
    const status = await this.unlock();
    await wait(status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0);

    const response = await TrezorConnect.ethereumSignTypedData({
      path: this.#pathFromAddress(address),
      data: {
        types: { ...types, EIP712Domain: types.EIP712Domain ?? [] },
        message,
        domain,
        primaryType,
      },
      metamask_v4_compat: true, // eslint-disable-line camelcase
      // Trezor 1 only supports blindly signing hashes
      domain_separator_hash, // eslint-disable-line camelcase
      message_hash: message_hash ?? '', // eslint-disable-line camelcase
    });

    if (response.success) {
      if (ethUtil.toChecksumAddress(address) !== response.payload.address) {
        throw new Error('signature doesnt match the right address');
      }
      return response.payload.signature;
    }
    // @ts-ignore
    throw new Error(response.payload?.error || 'Unknown error');
  }

  #addressFromIndex(basePath: string, i: number) {
    const dkey = this.hdk.derive(`${basePath}/${i}`);
    const address = ethUtil
      .publicToAddress(dkey.publicKey, true)
      .toString('hex');
    return ethUtil.toChecksumAddress(`0x${address}`);
  }

  #pathFromAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    let index = this.paths[checksummedAddress];
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this.#addressFromIndex(pathBase, i)) {
          index = i;
          break;
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address');
    }
    return `${this.hdPath}/${index}`;
  }
}
