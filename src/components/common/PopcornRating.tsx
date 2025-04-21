import React from 'react';
import PopcornIcon from './PopcornIcon';

interface PopcornRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'regular' | 'small';
  showPartialFill?: boolean;
  title?: string;
}

const PopcornRating: React.FC<PopcornRatingProps> = ({ 
  rating, 
  maxRating = 9, 
  size = 'regular',
  showPartialFill = true,
  title
}) => {
  const getPopcornIcons = () => {
    return [...Array(maxRating)].map((_, index) => {
      const hasPartial = showPartialFill && rating % 1 >= 0.25 && rating % 1 < 0.75;
      const partialIndex = hasPartial ? Math.floor(rating) : -1;

      if (index === partialIndex) {
        return <PopcornIcon key={index} filled={true} partial={true} size={size} />;
      } else if (index < Math.floor(rating)) {
        return <PopcornIcon key={index} filled={true} size={size} />;
      } else {
        return <PopcornIcon key={index} filled={false} size={size} />;
      }
    });
  };

  return (
    <div 
      className="flex items-center space-x-0.5" 
      title={title || `Rating: ${rating} out of ${maxRating}`}
    >
      {getPopcornIcons()}
    </div>
  );
};

export default PopcornRating;