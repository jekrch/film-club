import React from 'react';

interface PopcornIconProps {
  filled: boolean;
  size?: 'regular' | 'small';
  partial?: boolean;
}

const PopcornIcon: React.FC<PopcornIconProps> = ({ filled, size = 'regular', partial = false }) => {
  // Use CSS filters to make unfilled icons appear darker/greyed out
  const filterClass = filled ? '' : 'brightness-50 opacity-60';

  // Dynamic sizing based on the size prop
  let sizeClass = size === 'small' ? 'w-4 h-4' : 'w-7 h-7';

  if (partial && size === 'small')
    sizeClass += ' mt-[0.1em]';

  if (!partial) {
    return (
      <div className="relative inline-block">
        <img
          src="/popcorn.svg"
          alt={filled ? "Filled popcorn" : "Empty popcorn"}
          className={`inline-block ${sizeClass} ${filterClass}`}
        />
      </div>
    );
  }

  // For partial fill, use a different approach that works better at both sizes
  return (
    <div className={`relative inline-block ${sizeClass}`}>
      {/* Background empty popcorn */}
      <img
        src="/popcorn.svg"
        alt="Empty portion"
        className={`absolute inset-0 brightness-50 opacity-60 ${sizeClass}`}
      />
      {/* Filled portion - using clip-path for precise horizontal cut */}
      <img
        src="/popcorn.svg"
        alt="Filled portion"
        className={`absolute inset-0 ${sizeClass}`}
        style={{
          clipPath: 'inset(0 50% 0 0)',
          WebkitClipPath: 'inset(0 50% 0 0)'
        }}
      />
    </div>
  );
};

export default PopcornIcon;