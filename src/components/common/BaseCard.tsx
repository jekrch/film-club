import classNames from 'classnames';
import React from 'react';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string; 
}

const BaseCard: React.FC<BaseCardProps> = (props: BaseCardProps) => {
  return (
    <div className={classNames("bg-slate-800 rounded-lg shadow-slate-900 shadow-md border border-slate-700 p-4", props.className)}>
      {props.children}
    </div>
  );
};

export default BaseCard;