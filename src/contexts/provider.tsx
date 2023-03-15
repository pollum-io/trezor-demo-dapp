import React, { createContext, useContext, useEffect, useState } from 'react';

const storedPrefix =
  window.localStorage && window.localStorage.getItem('pali_provider');

const defaultValue = {
  provider: window.pali ?? undefined,
  setProvider: ((state: any) => state) as any,
  setPrefix: ((state: any) => state) as any,
  prefix: storedPrefix || 'sys',
  isLoading: false,
  setIsLoading: ((state: any) => state) as any,
};

const ProviderContext = createContext(defaultValue);

export const PaliWalletProvider = ({ children }: { children: any; }) => {
  const { pali } = window;

  const [prefix, setPrefix] = useState('sys');
  const [provider, setProvider] = useState(pali ?? undefined);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


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
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
};

export const useProviderContext = () => useContext(ProviderContext);