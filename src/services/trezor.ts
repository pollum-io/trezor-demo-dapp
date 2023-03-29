import TrezorConnect, {
  DEVICE_EVENT,
  SignTransaction,
} from '@trezor/connect-web';
import { Buffer } from 'buffer';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { transformTypedData } from '@trezor/connect-plugin-ethereum';

const hdPathString = `m/44'/60'/0'/0/0`;
const pathBase = `m/44'/60'/0'/0`;
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
const TREZOR_CONNECT_MANIFEST = {
  appUrl: 'https://paliwallet.com/',
  email: 'pali@pollum.io',
};

export interface TrezorControllerState {
  hdPath: string;
  paths: Record<string, number>;
}

interface ISignUtxoTx extends SignTransaction {
  coin: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    TrezorConnect: any;
  }
}
export class TrezorKeyring {
  hdPath: string = hdPathString;
  publicKey: Buffer;
  chainCode: Buffer;
  paths: Record<string, number> = {};
  model?: string;

  constructor() {
    this.publicKey = Buffer.from('', 'hex');
    this.chainCode = Buffer.from('', 'hex');
    this.hdPath = '';
    TrezorConnect.on(DEVICE_EVENT, (event: any) => {
      if (event.payload.features) {
        this.model = event.payload.features.model;
      }
    });
  }

  async init() {
    window.TrezorConnect = TrezorConnect;
    try {
      await TrezorConnect.init({
        manifest: TREZOR_CONNECT_MANIFEST,
        lazyLoad: true,
        connectSrc: 'https://connect.trezor.io/9/',
      });
      return true;
    } catch (error) {
      if (
        error.message.includes('TrezorConnect has been already initialized')
      ) {
        return true;
      }
      return false;
    }
  }

  convertToAddressNFormat(path: string) {
    const pathArray = path.replace(/'/g, '').split('/');

    pathArray.shift();

    const addressN = [];

    for (const index in pathArray) {
      if (Number(index) <= 2 && Number(index) >= 0) {
        addressN[Number(index)] = Number(pathArray[index]) | 0x80000000;
      } else {
        addressN[Number(index)] = Number(pathArray[index]);
      }
    }

    return addressN;
  }

  async deriveAccount({
    index,
    slip44,
    bip,
    coin,
  }: {
    index: number;
    slip44: number | string;
    bip: number;
    coin: string;
  }) {
    const keypath = `m/${bip}'/${slip44}'/0'/0/${index}`;

    return new Promise((resolve, reject) => {
      TrezorConnect.getAccountInfo({
        path: keypath,
        coin: coin,
      })
        .then((response) => {
          if (response.success) {
            resolve(response.payload);
          }
          // @ts-ignore
          reject(response.payload.error);
        })
        .catch((error) => {
          console.error('TrezorConnectError', error);
          reject(error);
        });
    });
  }

  async getAccountInfo({
    coin,
    slip44,
    hdPath,
  }: {
    coin: string;
    slip44: string;
    hdPath?: string;
  }) {
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

    if (hdPath) this.hdPath === hdPath;

    try {
      const address = await TrezorConnect.getAccountInfo({
        coin,
        path: this.hdPath,
      });

      return address.payload;
    } catch (error) {
      throw error;
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

  async verifyMessage({
    coin,
    address,
    message,
    signature,
  }: {
    coin: string;
    address: string;
    message: string;
    signature: string;
  }) {
    try {
      let method = '';
      switch (coin) {
        case 'eth':
          method = 'ethereumVerifyMessage';
          break;
        default:
          method = 'verifyMessage';
      }

      const { success, payload } = await TrezorConnect[method]({
        coin,
        address,
        message,
        signature,
      });

      if (success) {
        return { success, payload };
      }
      return { success: false, payload };
    } catch (error) {
      return { error };
    }
  }

  async getPublicKey({
    coin,
    slip44,
    hdPath,
  }: {
    coin: string;
    slip44: string;
    hdPath?: string;
  }) {
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

    if (hdPath) this.hdPath = hdPath;

    try {
      const { success, payload } = await TrezorConnect.getPublicKey({
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
    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'`;
        break;
      case 'btc':
        this.hdPath = "m/49'/0'/0'";
        break;
      case 'eth':
        this.hdPath = pathBase;
        break;
      default:
        this.hdPath = `m/44'/${slip44}'/0'/0`;
        break;
    }

    const account = await this._addressFromIndex(
      this.hdPath,
      index,
      coin,
      slip44
    );
    this.paths[account] = index;

    return account;
  }

  async signUtxoTransaction({ inputs, outputs, coin }: ISignUtxoTx) {
    try {
      const { payload, success } = await TrezorConnect.signTransaction({
        coin,
        inputs,
        outputs,
      });

      if (success) {
        return { success, payload };
      }
      return { success: false, payload };
    } catch (error) {
      return { error };
    }
  }

  async signEthTransaction({
    tx,
    accountIndex,
  }: {
    tx: any;
    accountIndex: string;
  }) {
    try {
      const { success, payload } = await TrezorConnect.ethereumSignTransaction({
        path: `m/44'/60'/0'/0/${accountIndex}`,
        transaction: tx,
      });

      if (success) {
        return { success, payload };
      }
      return { success: false, payload };
    } catch (error) {
      return { error };
    }
  }

  async signMessage({
    accountIndex,
    data,
    coin,
    slip44,
  }: {
    accountIndex?: number;
    data?: string;
    coin: string;
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

    if (coin === 'eth' && `${accountIndex}` && data) {
      return this.signEthPersonalMessage(Number(accountIndex), data);
    }
    return this.signUtxoPersonalMessage({ coin, hdPath: this.hdPath });
  }

  async signUtxoPersonalMessage({
    coin,
    hdPath,
  }: {
    coin: string;
    hdPath: string;
  }) {
    try {
      const { success, payload } = await TrezorConnect.signMessage({
        path: hdPath,
        coin: coin,
        message: 'UTXO example message',
      });

      if (success) {
        return { success, payload };
      }
      return { success: false, payload };
    } catch (error) {
      return { error };
    }
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
          message: Web3.utils.stripHexPrefix(message),
        })
          .then((response) => {
            if (response.success) {
              if (
                response.payload.address.toLowerCase() !==
                accountAddress.toLowerCase()
              ) {
                reject(new Error('signature doesnt match the right address'));
              }
              const signature = `0x${response.payload.signature}`;
              resolve({ signature, success: true });
            } else {
              reject(
                // @ts-ignore
                new Error(response.payload.error || 'Unknown error')
              );
            }
          })
          .catch((e) => {
            reject(new Error(e.toString() || 'Unknown error'));
          });
        // This is necessary to avoid popup collision
        // between the unlock & sign trezor popups
      }, DELAY_BETWEEN_POPUPS);
    });
  }

  /**
   * EIP-712 Sign Typed Data
   */
  async signTypedData({
    version,
    address,
    data,
  }: {
    version: 'V1' | 'V3' | 'V4';
    address: string;
    data: any;
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
      path: await this._pathFromAddress(address, 'eth', '60'),
      data: {
        types: {
          ...types,
          EIP712Domain: types.EIP712Domain ? types.EIP712Domain : [],
        },
        message,
        domain,
        primaryType: primaryType as any,
      },
      metamask_v4_compat: true, // eslint-disable-line camelcase
      // Trezor 1 only supports blindly signing hashes
      domain_separator_hash, // eslint-disable-line camelcase
      message_hash: message_hash ?? '', // eslint-disable-line camelcase
    });

    if (response.success) {
      if (address !== response.payload.address) {
        throw new Error('signature doesnt match the right address');
      }
      return response.payload;
    }
    // @ts-ignore
    throw new Error(response.payload.error || 'Unknown error');
  }

  async _addressFromIndex(
    basePath: string,
    i: number,
    coin: string,
    slip44: string
  ) {
    this.hdPath = `${basePath}/${i}`;
    await this.getPublicKey({ coin, slip44, hdPath: this.hdPath });
    const address = ethers.utils.computeAddress(
      `0x${this.publicKey.toString('hex')}`
    );
    return `${address}`;
  }

  async getAddress({
    coin,
    slip44,
    index,
  }: {
    coin: string;
    index: string | number;
    slip44?: string;
  }) {
    switch (coin) {
      case 'sys':
        this.hdPath = `m/84'/57'/0'/0`;
        break;
      case 'btc':
        this.hdPath = "m/49'/0'/0'";
        break;
      default:
        this.hdPath = `m/44'/${slip44}'/0'/0/0`;
        break;
    }
    try {
      const { payload, success } = await TrezorConnect.getAddress({
        path: `${this.hdPath}/${index}`,
        coin,
      });
      if (success) {
        return { success, payload };
      }
      return { success: false, payload };
    } catch (error) {
      return { error };
    }
  }

  async _pathFromAddress(address: string, coin: string, slip44: string) {
    if (ethers.utils.isAddress(address)) {
      const checksummedAddress = address;
      let index = this.paths[checksummedAddress];
      if (typeof index === 'undefined') {
        for (let i = 0; i < MAX_INDEX; i++) {
          if (
            checksummedAddress ===
            (await this._addressFromIndex(pathBase, i, coin, slip44))
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
    return '';
  }
}
