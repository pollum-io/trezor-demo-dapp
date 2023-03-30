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
        <PrimaryButton
          text="Get address"
          onClick={() =>
            handleExecution('getAddress', {
              coin: 'sys',
              index: 1,
            })
          }
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

        <PrimaryButton
          text="Verify message"
          onClick={() =>
            handleExecution('verifyMessage', {
              coin: 'btc',
              address: '3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX',
              message: 'Example message',
              signature:
                'I6BrpivjCwZmScZ6BMAHWGQPo+JjX2kzKXU5LcGVfEgvFb2VfJuKo3g6eSQcykQZiILoWNUDn5rDHkwJg3EcvuY=',
            })
          }
        />

        <PrimaryButton
          text="Sign transaction"
          onClick={() =>
            handleExecution('signUtxoTransaction', {
              inputs: [
                {
                  address_n: [-2147483604, -2147483648, -2147483648, 0, 5],
                  prev_hash:
                    '50f6f1209ca92d7359564be803cb2c932cde7d370f7cee50fd1fad6790f6206d',
                  prev_index: 1,
                },
              ],
              outputs: [
                {
                  address:
                    'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
                  amount: '10000',
                  script_type: 'PAYTOADDRESS',
                },
              ],
              coin: 'btc',
            })
          }
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
          params={{ coin: 'eth', slip44: '60' }}
          fn={handleExecution}
        />

        <PrimaryButton
          text="Derive account"
          onClick={() =>
            handleExecution('deriveAccount', {
              index: 0,
              slip44: 60,
              bip: 44,
              coin: 'eth',
            })
          }
        />

        <PrimaryButton
          text="Sign message"
          onClick={() =>
            handleExecution('signMessage', {
              accountIndex: 0,
              message: 'PaliTrezor example',
              coin: 'eth',
            })
          }
        />

        <PrimaryButton
          text="Verify message"
          onClick={() =>
            handleExecution('verifyMessage', {
              coin: 'eth',
              address: '0xdA0b608bdb1a4A154325C854607c68950b4F1a34',
              message: 'Example message',
              signature:
                '11dc86c631ef5d9388c5e245501d571b864af1a717cbbb3ca1f6dacbf330742957242aa52b36bbe7bb46dce6ff0ead0548cc5a5ce76d0aaed166fd40cb3fc6e51c',
            })
          }
        />

        <PrimaryButton
          text="Sign transaction"
          onClick={() =>
            handleExecution('signEthTransaction', {
              accountIndex: 0,
              tx: {
                nonce: '0x0',
                gasPrice: '0x14',
                gasLimit: '0x14',
                to: '0xd0d6d6c5fe4a677d343cc433536bb717bae167dd',
                chainId: 1,
                value: '0x0',
                data: '0xa9059cbb000000000000000000000000574bbb36871ba6b78e27f4b4dcfb76ea0091880b000000000000000000000000000000000000000000000000000000000bebc200',
              },
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
