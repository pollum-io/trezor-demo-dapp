import React, { useState } from 'react';

import { Card } from '../Card';
import { Output } from '../Output';
import {
  DropdownButton,
  PrimaryButton,
  SecondDropdownButton,
} from '../Buttons/Button';
import { coins } from '../../utils/coins';
import { data } from '../../data';
import { useProviderContext } from '../../contexts/provider';
import { usePaliMethods } from '../../contexts/requests';

export const FirstRow = () => {
  const { request } = usePaliMethods();
  const { prefix } = useProviderContext();

  const [output, setOutput] = useState('');

  const onSubmit = async (type: string) => {
    const message = data[type];
    const method = `${prefix}_${type}`;

    // note: check the data object first to be aware of why this method would not work if called this way
    request(method, [message]).then((response) => {
      setOutput(JSON.stringify(response));
    });
  };

  return (
    <div className="bg-bkg-3 md:rounded-md grid lg:grid-cols-3 gap-y-4 lg:gap-y-0 md:gap-x-4 py-5 justify-center align-center w-full h-max">
      <BasicActionsCard />
      <BasicEthereumActionsCard />
    </div>
  );
};

const BasicActionsCard = () => {
  const { trezor } = useProviderContext();
  const [output, setOutput] = useState('');

  const handleExecution = async (methodName: string, params?: any) => {
    const data = await trezor[methodName]({ ...params });
    setOutput(JSON.stringify(data));
  };

  return (
    <Card title="BASIC ACTIONS [UTXO]">
      <div className="grid grid-rows-3 gap-y-3 rounded-full">
        <DropdownButton
          text="Get account info"
          method="getAccountInfo"
          fn={handleExecution}
          coins={Object.values(coins)}
        />

        <DropdownButton
          text="Get Public Key"
          method="getPublicKey"
          fn={handleExecution}
          coins={Object.values(coins)}
        />

        <DropdownButton
          text="Sign message"
          method="signMessage"
          fn={handleExecution}
          coins={Object.values(coins)}
        />


        <Output output={output || ' '} />
      </div>
    </Card>
  );
};

const BasicEthereumActionsCard = () => {
  const { trezor } = useProviderContext();
  const [output, setOutput] = useState('');

  const handleExecution = async (methodName: string, params?: any) => {
    const data = await trezor[methodName]({ ...params });
    setOutput(JSON.stringify(data));
  };

  return (
    <Card title="BASIC ACTIONS [EVM]">
      <div className="grid grid-rows-3 gap-y-3 rounded-full">
        <DropdownButton
          text="Get account info"
          method="getAccountInfo"
          fn={handleExecution}
          coins={[{ slip44: 60, coinShortcut: 'eth', coinName: 'Ethereum' }]}
        />

        <PrimaryButton
          text="Get Public Key"
          onClick={() =>
            handleExecution('getPublicKey', { coin: 'eth', slip44: '60' })
          }
        />

        <SecondDropdownButton
          text="Get address by index"
          method="getAccountByIndex"
          fn={handleExecution}
        />

        <PrimaryButton
          text="Sign message"
          onClick={() =>
            handleExecution('signMessage', {
              accountIndex: 0,
              data: 'PaliTrezor example',
            })
          }
        />

        <PrimaryButton
          text="Sign Typed Data"
          onClick={() =>
            handleExecution('signTypedData', {
              address: '0x1b02483786D647397C58940C65929f9ab662D748',
              data: {
                types: { EIP712Domain: [] },
                domain: {},
                message: {},
                primaryType: 'EIP712Domain',
              },
              version: 'V4',
            })
          }
        />

        <Output output={output || ' '} />
      </div>
    </Card>
  );
};
