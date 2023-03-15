import React from 'react';
import { useProviderContext } from '../../contexts/provider';
import { LoadingComponent } from '../Loading';

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

export const PrimaryButton: React.FC<IButton> = ({
  disabled = false,
  id = '',
  loading = false,
  onClick,
  text,
  type = 'button',
  loadingComponent,
}) => {
  const {} = useProviderContext();
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
