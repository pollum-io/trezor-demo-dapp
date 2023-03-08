import React from 'react';

import logo from '../assets/images/logo.svg';
import trezorLogo from '../assets/images/trezorLogo.svg';

import { FirstRow } from './Rows/FirstRow';
import { SecondRow } from './Rows/SecondRow';
import { ThirdRow } from './Rows/ThirdRow';
import { FourthRow } from './Rows/FourthRow';

export const Body = () => (
  <div className="grid md:gap-y-3 text-center w-full h-max">
    <FirstRow />
    <SecondRow />

    <ThirdRow />
    <FourthRow />

    <div className="flex flex-row items-center justify-center w-full py-4">
      <img src={logo} alt="" className="w-32 md:w-40" />
      <div className="cursor-default ml-5 text-brand-royalblue font-poppins text text-2xl md:text-4xl font-bold tracking-wide leading-4">
        |
      </div>
      <img
        src={trezorLogo}
        alt=""
        className="w-32 md:w-40 trezor relative bottom-3 ml-5"
      />
    </div>
  </div>
);
