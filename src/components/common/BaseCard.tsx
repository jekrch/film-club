import classNames from 'classnames';
import React from 'react';

interface BaseCardProps {
  children: React.ReactNode;
  className?: string; 
}

const BaseCard: React.FC<BaseCardProps> = (props: BaseCardProps) => {
  return (
    // Shares the flat `card` surface with AccentCard so the two never read as
    // different shades when they sit side by side.
    <div className={classNames("rounded-lg shadow-sm shadow-black/30 border border-slate-700/60 p-4", props.className)}>
      {props.children}
    </div>
  );
};

export default BaseCard;