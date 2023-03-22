import React, { useEffect, useState } from 'react';
import { usePaliMethods } from '../contexts/requests';

import logo from '../assets/images/logo.svg';
import trezorLogo from '../assets/images/trezorLogo.svg';
import { useProviderContext } from '../contexts/provider';

export const Header = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { setPrefix, prefix, trezor } = useProviderContext();
  const { init } = trezor;

  const handleInit = async () => {
    const isInitialized = await init();
    setIsConnected(isInitialized);
  };
  const {
    state: { account, network },
  } = usePaliMethods();

  const options = {
    sys: {
      label: 'Provider - Syscoin',
      value: 'sys',
    },
    eth: {
      label: 'Provider - Ethereum',
      value: 'eth',
    },
  };

  const stored = window.localStorage.getItem('pali_provider');

  useEffect(() => {
    if (stored !== options[prefix]) setPrefix(stored);
  }, []);

  window.onload = () => alert('Initialize your Trezor before testing methods');

  return (
    <div className="flex flex-col md:flex-row justify-center py-10 md:justify-between align-center">
      <div className="flex flex-row items-center justify-center">
        <img src={logo} alt="" className="w-32 md:w-40" />
        <div className="cursor-default text-brand-royalblue font-poppins text text-2xl md:text-4xl font-bold tracking-wide leading-4">
          Pali Wallet
        </div>
        <div className="cursor-default ml-5 text-brand-royalblue font-poppins text text-2xl md:text-4xl font-bold tracking-wide leading-4">
          |
        </div>
        <img
          src={trezorLogo}
          alt=""
          className="w-32 md:w-40 trezor relative bottom-3 ml-2"
        />
      </div>

      <div className="grid gap-y-1 py-4 justify-center items-center">
        <div className="w-64 h-11 bg-brand-deepPink100 px-4 py-1 rounded-full text-sm font-poppins flex items-center">
          Connected: {isConnected ? 'True' : 'False'}
        </div>
        <div
          onClick={handleInit}
          className="cursor-pointer bg-bkg-4 w-64 h-12 hover:bg-brand-royalblue px-4 py-1 rounded-full text-sm font-poppins flex items-center"
        >
          Initialize Trezor
        </div>
      </div>
    </div>
  );
};
