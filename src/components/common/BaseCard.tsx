import classNames from 'classnames';
import React from 'react';

interface BaseCardProps {
  key?: string;
  children: React.ReactNode;
  className?: string; 
}

const BaseCard: React.FC<BaseCardProps> = ({ key, children, className = '' }) => {
  return (
    <div key={key} className={classNames("bg-slate-800 rounded-lg shadow-slate-900 shadow-md border border-slate-700 p-4", className)}>
      {children}
    </div>
  );
};

export default BaseCard;