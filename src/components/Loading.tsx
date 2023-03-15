import React, { FC } from 'react';
import { LoaderIcon } from './LoaderIcon';

const icons = {
  loading: LoaderIcon,
};

interface IIcon {
  className?: string;
  id?: string;
  name: string;
  rotate?: number;
  wrapperClassname?: string;
}

const Icon: FC<IIcon> = ({
  className,
  id,
  name,
  rotate,
  wrapperClassname,
}) => {
  const Component = icons[name];

  return (
    <div className={wrapperClassname} id={id}>
      {Component && <Component className={className} rotate={rotate} />}
    </div>
  );
};

export const LoadingComponent = ({ opacity = 10 }: { opacity?: number }) => (
  <>
    <div
      className={`relative flex flex-col ml-2 sitems-center justify-center w-fit bg-transparent`}
      style={{ zIndex: '9' }}
    >
      <div className={`flex items-center justify-center opacity-${opacity}`}>
        <Icon
          name="loading"
          className="text-brand-white animate-spin-slow text-sm"
        />
      </div>
    </div>
  </>
);
