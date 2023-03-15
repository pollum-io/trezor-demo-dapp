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
const SLIP0044TestnetPath = `m/44'/1'/0'/0`;

const ALLOWED_HD_PATHS = {
  [hdPathString]: true,
  [SLIP0044TestnetPath]: true,
} as const;

const keyringType = 'Trezor Hardware';
const pathBase = 'm';
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
const TREZOR_CONNECT_MANIFEST = {
  appUrl: 'https://paliwallet.com/',
  email: 'pali@pollum.io',
};

export interface TrezorControllerOptions {
  hdPath?: string;
  accounts?: string[];
  page?: number;
  perPage?: number;
  setIsLoading?: () => void;
}

export interface TrezorControllerState {
  hdPath: string;
  accounts: readonly string[];
  page: number;
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
  static type: string = keyringType;

  readonly type: string = keyringType;

  isInitialized: boolean;
  isWaiting: boolean;

  accounts: readonly string[] = [];

  hdk: HDKey = new HDKey();

  setIsLoading: (isLoading: boolean) => void;

  hdPath: string = hdPathString;

  page = 0;

  perPage = 5;

  unlockedAccount = 0;

  paths: Record<string, number> = {};

  trezorConnectInitiated = false;

  model?: string;

  constructor(opts: TrezorControllerOptions = {}) {
    this.deserialize(opts);

    TrezorConnect.on(DEVICE_EVENT, (event) => {
      if (hasDevicePayload(event)) {
        this.model = event.payload.features?.model;
      }
    });
    TrezorConnect.on('device-connect', (event) => {
      this.isInitialized = event.features?.initialized;
    });
  }

  async initialize() {
    this.setIsLoading(true);

    window.TrezorConnect = TrezorConnect;

    try {
      await TrezorConnect.init({
        manifest: TREZOR_CONNECT_MANIFEST,
      });
      const address = await TrezorConnect.ethereumGetAddress({
        path: hdPathString,
        showOnTrezor: true,
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

  async serialize(): Promise<TrezorControllerState> {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      page: this.page,
      paths: this.paths,
      perPage: this.perPage,
      unlockedAccount: this.unlockedAccount,
    });
  }

  async deserialize(opts: TrezorControllerOptions = {}) {
    this.hdPath = opts.hdPath ?? hdPathString;
    this.accounts = opts.accounts ?? [];
    this.page = opts.page ?? 0;
    this.perPage = opts.perPage ?? 5;
    this.setIsLoading = opts.setIsLoading;
    return Promise.resolve();
  }

  isUnlocked() {
    return Boolean(this.hdk?.publicKey);
  }

  async unlock() {
    if (this.isUnlocked()) {
      return Promise.resolve('already unlocked');
    }
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

  setAccountToUnlock(index: number | string) {
    this.unlockedAccount = parseInt(String(index), 10);
  }

  async addAccounts(n = 1): Promise<readonly string[]> {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then((_) => {
          const from = this.unlockedAccount;
          const to = from + n;

          for (let i = from; i < to; i++) {
            const address = this.#addressFromIndex(pathBase, i);
            if (!this.accounts.includes(address)) {
              this.accounts = [...this.accounts, address];
            }
            this.page = 0;
          }
          resolve(this.accounts);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  async getFirstPage() {
    this.page = 0;
    return this.#getPage(1);
  }

  async getNextPage() {
    return this.#getPage(1);
  }

  async getPreviousPage() {
    return this.#getPage(-1);
  }
  // @ts-ignore
  async #getPage(
    increment: number
  ): Promise<{ address: string; balance: number | null; index: number }[]> {
    this.page += increment;

    if (this.page <= 0) {
      this.page = 1;
    }

    return new Promise((resolve, reject) => {
      this.unlock()
        .then((_) => {
          const from = (this.page - 1) * this.perPage;
          const to = from + this.perPage;

          const accounts: any[] = [];

          for (let i = from; i < to; i++) {
            const address = this.#addressFromIndex(pathBase, i);
            accounts.push({
              address,
              balance: null,
              index: i,
            });
            this.paths[ethUtil.toChecksumAddress(address)] = i;
          }
          resolve(accounts);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  async getAccounts() {
    return Promise.resolve(this.accounts.slice());
  }

  removeAccount(address: string) {
    if (
      !this.accounts.map((a) => a.toLowerCase()).includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in this keyring`);
    }

    this.accounts = this.accounts.filter(
      (a) => a.toLowerCase() !== address.toLowerCase()
    );
  }

  async signMessage(withAccount: string, data: string) {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(withAccount: string, message: string) {
    return new Promise((resolve, reject) => {
      this.unlock()
        .then((status) => {
          setTimeout(
            () => {
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
                      reject(
                        new Error('signature doesnt match the right address')
                      );
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
            },
            status === 'just unlocked' ? DELAY_BETWEEN_POPUPS : 0
          );
        })
        .catch((e) => {
          reject(new Error(e?.toString() || 'Unknown error'));
        });
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

  async exportAccount() {
    return Promise.reject(new Error('Not supported on this device'));
  }

  forgetDevice() {
    this.accounts = [];
    this.hdk = new HDKey();
    this.page = 0;
    this.unlockedAccount = 0;
    this.paths = {};
  }

  /**
   * Set the HD path to be used by the keyring. Only known supported HD paths are allowed.
   *
   * If the given HD path is already the current HD path, nothing happens. Otherwise the new HD
   * path is set, and the wallet state is completely reset.
   *
   * @throws {Error] Throws if the HD path is not supported.
   *
   * @param hdPath - The HD path to set.
   */
  setHdPath(hdPath: keyof typeof ALLOWED_HD_PATHS) {
    if (!ALLOWED_HD_PATHS[hdPath]) {
      throw new Error(
        `The setHdPath method does not support setting HD Path to ${hdPath}`
      );
    }

    // Reset HDKey if the path changes
    if (this.hdPath !== hdPath) {
      this.hdk = new HDKey();
      this.accounts = [];
      this.page = 0;
      this.perPage = 5;
      this.unlockedAccount = 0;
      this.paths = {};
    }
    this.hdPath = hdPath;
  }

  #normalize(buf: Buffer) {
    return ethUtil.bufferToHex(buf).toString();
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
