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
    this.hdk = new HDKey();

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
      case 'btc':
        this.hdPath = "m/49'/0'/0'";
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

  async getPublicKey({ coin, slip44 }: { coin: string; slip44: string }) {
    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'`;
        break;
      case 'btc':
        this.hdPath = "m/49'/0'/0'";
        break;
      default:
        this.hdPath = `m/44'/${slip44}'/0'/0/0`;
        break;
    }
    try {
      const { success, payload } = await TrezorConnect.getPublicKey({
        coin: coin,
        path: this.hdPath,
      });

      console.log({
        coin: coin,
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

      return { success: false, payload };
    } catch (error) {
      return error;
    }
  }

  async getAccountByIndex({
    index,
    coin,
    slip44,
  }: {
    index: number;
    coin: string;
    slip44: string;
  }) {
    const account = await this.#addressFromIndex(
      this.hdPath,
      index,
      coin,
      slip44
    );
    this.paths[account] = index;

    return account;
  }

  async deserialize(opts: TrezorControllerOptions = {}) {
    this.hdPath = opts.hdPath ?? hdPathString;
    this.setIsLoading = opts.setIsLoading;
    return Promise.resolve();
  }

  async signMessage({
    accountIndex,
    data,
    coin,
    slip44,
  }: {
    accountIndex?: number;
    data?: string;
    coin?: string;
    slip44?: string;
  }) {
    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'/0/0`;
        break;
      case 'btc':
        this.hdPath = "m/49'/0'/0'/0/0";
        break;
      default:
        this.hdPath = `m/44'/${slip44}'/0'/0/0`;
        break;
    }

    if (coin === 'eth') return this.signEthPersonalMessage(accountIndex, data);
    return this.signUtxoPersonalMessage({ coin, hdPath: this.hdPath });
  }

  async signUtxoPersonalMessage({
    coin,
    hdPath,
  }: {
    coin: string;
    hdPath: string;
  }) {
    const { success, payload } = await TrezorConnect.signMessage({
      path: hdPath,
      coin: coin,
      message: 'UTXO example message',
    });

    if (success) {
      return payload;
    }
    return { success: false };
  }

  // For personal_sign, we need to prefix the message:
  async signEthPersonalMessage(accountIndex: number, message: string) {
    const accountAddress = await this.getAccountByIndex({
      index: accountIndex,
      coin: 'eth',
      slip44: '60',
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
      path: await this.#pathFromAddress(address, 'eth', '60'),
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

  async #addressFromIndex(
    basePath: string,
    i: number,
    coin: string,
    slip44: string
  ) {
    this.hdPath = `${basePath}/${i}`;
    await this.getPublicKey({ coin, slip44 });
    const address = ethUtil
      .publicToAddress(this.publicKey, true)
      .toString('hex');
    return ethUtil.toChecksumAddress(`0x${address}`);
  }

  async #pathFromAddress(address: string, coin: string, slip44: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    let index = this.paths[checksummedAddress];
    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (
          checksummedAddress ===
          (await this.#addressFromIndex(pathBase, i, coin, slip44))
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
