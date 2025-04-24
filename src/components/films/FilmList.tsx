import React from 'react';
import { Film } from '../../types/film';
import FilmCard from './FilmCard';
import AllFilmsCard from './AllFilmsCard'; // 1. Import the new card component
import { useViewSettings } from '../../contexts/ViewSettingsContext';
import { Squares2X2Icon, RectangleGroupIcon } from '@heroicons/react/24/outline';

interface FilmListProps {
  films: Film[];
  title?: string;
  appendAllFilmsCard?: boolean; // 2. Add the new prop
}

// Set default value for the new prop in the function signature
const FilmList: React.FC<FilmListProps> = ({ films, title, appendAllFilmsCard = false }) => {
  const { cardSize, setCardSize } = useViewSettings();
  // Determine cardSize string literal type ('compact' or 'standard')
  const currentCardSize = cardSize === 'compact' ? 'compact' : 'standard';
  const isCompact = currentCardSize === 'compact';


  // Define base styles for the toggle buttons - more minimal
  const buttonBaseClasses = "p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800";
  const iconClasses = "w-5 h-5"; // Icon size

  // Adjust grid columns based on card size preference
  const gridClasses = isCompact
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  const gapClass = isCompact ? 'gap-3 md:gap-4' : 'gap-6';

  // Determine if there's anything to display in the grid
  const hasContent = films.length > 0 || appendAllFilmsCard;

  return (
    <div className="py-8">
      {/* Header Section with Title and View Toggle */}
      <div className="flex justify-between items-center mb-6">
        {title && (
          <h2 className="text-2xl font-bold text-gray-200">{title}</h2>
        )}

        {/* View Mode Toggle Buttons - Minimal Style */}
        <div className="flex items-center space-x-2">

          {/* Compact View Button */}
          <button
            onClick={() => setCardSize('compact')}
            title="Compact View"
            aria-pressed={isCompact}
            className={`
              ${buttonBaseClasses}
              ${isCompact
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-100'
              }
            `}
          >
            <RectangleGroupIcon className={iconClasses} />
            <span className="sr-only">Compact View</span>
          </button>

          {/* Standard View Button */}
          <button
            onClick={() => setCardSize('standard')}
            title="Standard View"
            aria-pressed={!isCompact}
            className={`
              ${buttonBaseClasses}
              ${!isCompact
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-100'
              }
            `}
          >
            <Squares2X2Icon className={iconClasses} />
            <span className="sr-only">Standard View</span>
          </button>
        </div>
      </div>

      {/* Film Grid Section */}
      {!hasContent ? ( // Check if there is neither films nor the AllFilmsCard to show
        <div className="text-center py-10">
          {/* Modify empty state message slightly if needed, or keep as is */}
          <p className="text-gray-500">No films found.</p>
        </div>
      ) : (
        <div className={`grid ${gridClasses} ${gapClass}`}>
          {/* Map existing films */}
          {films.map((film) => (
            <FilmCard key={film.imdbID} film={film} cardSize={currentCardSize} />
          ))}

          {/* 3. Conditionally render AllFilmsCard at the end */}
          {appendAllFilmsCard && (
            <AllFilmsCard cardSize={currentCardSize} />
          )}
        </div>
      )}
    </div>
  );
};

export default FilmList;