import React from 'react';

interface IButton {
  className?: string;
  disabled?: boolean;
  id?: string;
  loading?: boolean;
  onClick?: () => any;
  text: string;
  type?: 'button' | 'submit' | 'reset';
  width?: string;
  loadingComponent?: any;
}

interface IDropdownButton extends IButton {
  fn?: (methodName: string, params?: any) => Promise<void>;
  method: string;
  coins: any[];
}

const availableIndexs = [...Array(31).keys()];

export const PrimaryButton: React.FC<IButton> = ({
  disabled = false,
  id = '',
  loading = false,
  onClick,
  text,
  type = 'button',
  loadingComponent,
}) => {
  return (
    <button
      className="bg-bkg-4 py-1.5 rounded-full cursor-pointer h-max font-poppins hover:bg-brand-royalblue flex flex-row p-5 items-center"
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      id={id}
    >
      {text}
      {loadingComponent}
    </button>
  );
};

export const DropdownButton: React.FC<IDropdownButton> = ({
  id = '',
  method,
  fn,
  coins,
  text,
}) => {
  return (
    <select
      name="provider"
      onChange={(event) => {
        const values = event.target.value.split(',');
        fn(method, {
          slip44: values[0],
          coin: values[1],
        });
      }}
      id={id}
      defaultValue="ConnectTrezor"
      className="bg-bkg-4 py-1.5 rounded-full cursor-pointer h-max font-poppins hover:bg-brand-royalblue flex flex-row p-5 items-center"
    >
      <option>{text}</option>
      {coins.map((option) => (
        <option
          key={option.coinShortcut.toLowerCase()}
          value={[option.slip44.toString(), option.coinShortcut.toLowerCase()]}
        >
          {option.coinName !== 'Connect Trezor' && 'Trezor - '}
          {option.coinName}
        </option>
      ))}
    </select>
  );
};

export const SecondDropdownButton: React.FC<any> = ({
  id = '',
  method,
  fn,
  text,
}) => {
  return (
    <select
      name="provider"
      onChange={(event) =>
        fn(method, {
          index: event.target.value,
        })
      }
      id={id}
      defaultValue="ConnectTrezor"
      className="bg-bkg-4 py-1.5 rounded-full cursor-pointer h-max font-poppins hover:bg-brand-royalblue flex flex-row p-5 items-center"
    >
      <option>{text}</option>
      {availableIndexs.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
};

interface IInput {
  placeholder: string;
  disabled?: boolean;
}

export const Input: React.FC<IInput> = ({ disabled = false, placeholder }) => (
  <input
    className="border border-bkg-4 bg-bkg-6 font-poppins text-left px-4 py-1 rounded-full h-max hover:border-fields-input-borderfocus focus:border-fields-input-borderfocus outline-none"
    disabled={disabled}
    placeholder={placeholder}
  />
);
