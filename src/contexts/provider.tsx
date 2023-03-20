import React, { createContext, useContext, useEffect, useState } from 'react';
import { TrezorKeyring } from '../services/trezor';

const storedPrefix =
  window.localStorage && window.localStorage.getItem('pali_provider');

// const defaultValue = {
//   provider: window.pali ?? undefined,
//   setProvider: ((state: any) => state) as any,
//   setPrefix: ((state: any) => state) as any,
//   prefix: storedPrefix || 'sys',
//   isLoading: false,
//   setIsLoading: ((state: any) => state) as any,
// };

interface IPaliProvider {
  prefix: string;
  setPrefix: React.Dispatch<React.SetStateAction<string>>;
  provider: Readonly<any>;
  setProvider: React.Dispatch<React.SetStateAction<Readonly<any>>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  trezor: TrezorKeyring;
}

const ProviderContext = createContext({} as IPaliProvider);

export const PaliWalletProvider = ({ children }: { children: any }) => {
  const { pali } = window;

  const [prefix, setPrefix] = useState('sys');
  const [provider, setProvider] = useState(pali ?? undefined);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const trezor = new TrezorKeyring({ setIsLoading } as any);

  useEffect(() => {
    const _provider = prefix === 'sys' ? window.pali : window.ethereum;

    setProvider(_provider);

    window.localStorage.setItem('pali_provider', prefix);
  }, [prefix]);

  useEffect(() => {
    setPrefix(storedPrefix);
    setHydrated(true);
    setProvider(provider);
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <ProviderContext.Provider
      value={{
        provider,
        setProvider,
        setPrefix,
        prefix,
        isLoading,
        setIsLoading,
        trezor,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export const useProviderContext = () => useContext(ProviderContext);