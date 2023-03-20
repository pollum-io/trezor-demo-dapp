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
const pathBase = `m/44'/60'/0'/0`;
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
  publicKey: Buffer;
  chainCode: Buffer;
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

  async init() {
    window.TrezorConnect = TrezorConnect;
    try {
      await TrezorConnect.init({
        manifest: TREZOR_CONNECT_MANIFEST,
      });
      alert('Trezor was initialized succesfully!');
    } catch (error) {
      alert(error);
    }
  }

  async getAccountInfo({ coin, slip44 }: { coin: string; slip44: string }) {
    this.setIsLoading(true);

    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'`;
        break;

      default:
        this.hdPath = `m/44'/${slip44}'/0'/0/0`;
        break;
    }

    try {
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
      const { success, payload } = await TrezorConnect.getPublicKey({
        coin: 'eth',
        path: this.hdPath,
      });

      if (success) {
        const { publicKey, chainCode } = payload;

        this.publicKey = Buffer.from(publicKey, 'hex');
        this.chainCode = Buffer.from(chainCode, 'hex');

        return {
          publicKey: `0x${this.publicKey.toString('hex')}`,
          chainCode: `0x${this.chainCode.toString('hex')}`,
        };
      }

      return { success: false };
    } catch (error) {
      return error;
    }
  }

  async getAccountByIndex({ index }: { index: number }) {
    const account = await this.#addressFromIndex(this.hdPath, index);
    this.paths[account] = index;

    return account;
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

  async signMessage({
    accountIndex,
    data,
  }: {
    accountIndex: number;
    data: string;
  }) {
    return this.signPersonalMessage(accountIndex, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(accountIndex: number, message: string) {
    const accountAddress = await this.getAccountByIndex({
      index: accountIndex,
    });
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        TrezorConnect.ethereumSignMessage({
          path: hdPathString,
          message: ethUtil.stripHexPrefix(message),
        })
          .then((response) => {
            if (response.success) {
              if (
                response.payload.address !==
                ethUtil.toChecksumAddress(accountAddress)
              ) {
                reject(new Error('signature doesnt match the right address'));
              }
              const signature = `0x${response.payload.signature}`;
              resolve({ signature, success: true });
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
  async signTypedData<T extends MessageTypes>({
    version,
    address,
    data,
  }: {
    version: SignTypedDataVersion;
    address: string;
    data: TypedMessage<T>;
  }) {
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

    const response = await TrezorConnect.ethereumSignTypedData({
      path: await this.#pathFromAddress(address),
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
      return response.payload;
    }
    // @ts-ignore
    throw new Error(response.payload?.error || 'Unknown error');
  }

  async #addressFromIndex(basePath: string, i: number) {
    this.hdPath = `${basePath}/${i}`;
    await this.getEthereumPublicKey();
    const address = ethUtil
      .publicToAddress(this.publicKey, true)
      .toString('hex');
    return ethUtil.toChecksumAddress(`0x${address}`);
  }

  async #pathFromAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    let index = this.paths[checksummedAddress];
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (
          checksummedAddress === (await this.#addressFromIndex(pathBase, i))
        ) {
          index = i;
          break;
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address');
    }
    return `${pathBase}/${index}`;
  }
}
