import React from 'react';
import { coins } from '../../utils/coins';

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
}

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
      <option disabled>Connect Trezor</option>
      {Object.values(coins).map((option) => (
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
