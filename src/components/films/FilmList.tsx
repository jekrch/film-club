import React from 'react'; 
import { Film } from '../../types/film';
import FilmCard from './FilmCard';
import AllFilmsCard from './AllFilmsCard';
import { useViewSettings } from '../../contexts/ViewSettingsContext';
import { Squares2X2Icon, RectangleGroupIcon, PhotoIcon } from '@heroicons/react/24/outline';


import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Scrollbar, Mousewheel } from 'swiper/modules'; // Import necessary modules
// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/free-mode';
// @ts-ignore
import 'swiper/css/scrollbar';



interface FilmListProps {
  films: Film[];
  title?: string;
  appendAllFilmsCard?: boolean;
  layoutMode?: 'grid' | 'horizontal';
  hideSizeButtons?: boolean;
}

const FilmList: React.FC<FilmListProps> = ({
  films,
  title,
  appendAllFilmsCard = false,
  layoutMode = 'grid',
  hideSizeButtons = false,
}) => {
  const { cardSize: contextCardSize, setCardSize } = useViewSettings();
  const actualCardSize = hideSizeButtons ? 'compact' : contextCardSize;
  const isCompact = actualCardSize === 'compact';
  const isPosterOnly = actualCardSize === 'poster';

  const buttonBaseClasses = "p-1.5 rounded-md transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800";
  const iconClasses = "w-5 h-5";

  // Adjust grid classes based on view mode
  const gridClasses = isPosterOnly
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' // Fewer columns for larger posters
    : isCompact
    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  const gapClass = isPosterOnly ? 'gap-3 md:gap-4' : isCompact ? 'gap-3 md:gap-4' : 'gap-6';
  const hasContent = films.length > 0 || appendAllFilmsCard;

  return (
    <div className="py-4">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-4">
        {/* ... Title and Buttons ... */}
         {title && (
           <h2 className="text-lg font-bold text-gray-200 mr-3">{title}</h2>
         )}
         {!hideSizeButtons && (
           <div className="flex items-center space-x-2">

             <button 
               onClick={() => setCardSize('compact')} 
               title="Compact View" 
               aria-pressed={isCompact && !isPosterOnly} 
               className={`${buttonBaseClasses} ${isCompact && !isPosterOnly ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}
             >
               <RectangleGroupIcon className={iconClasses} /><span className="sr-only">Compact View</span>
             </button>
             <button 
               onClick={() => setCardSize('standard')} 
               title="Standard View" 
               aria-pressed={!isCompact && !isPosterOnly} 
               className={`${buttonBaseClasses} ${!isCompact && !isPosterOnly ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}
             >
               <Squares2X2Icon className={iconClasses} /><span className="sr-only">Standard View</span>
             </button>
                          <button 
               onClick={() => setCardSize('poster')} 
               title="Poster View" 
               aria-pressed={isPosterOnly} 
               className={`${buttonBaseClasses} ${isPosterOnly ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}
             >
               <PhotoIcon className={iconClasses} /><span className="sr-only">Poster View</span>
             </button>
           </div>
         )}
      </div>

      {/* Film Content Section */}
      {!hasContent ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No films found.</p>
        </div>
      ) : layoutMode === 'horizontal' ? (
        // --- Horizontal Layout with Swiper ---
        <Swiper
            modules={[FreeMode, Scrollbar, Mousewheel]} // Add modules
            slidesPerView="auto" // Show as many slides as fit
            spaceBetween={isPosterOnly ? 12 : 16} // Adjust space based on view mode
            freeMode={true} // Enable free scrolling with momentum
            
            scrollbar={{ draggable: true, hide: false }} // Optional: Add scrollbar
            mousewheel={true} // Enable mousewheel control
            className="pb-4 text-gray-200" // Add padding for scrollbar visibility
        >
          {/* Map films to SwiperSlides */}
          {films.map((film) => (
            <SwiperSlide 
              key={film.imdbID} 
              style={{ width: 'auto' }} 
              className={isPosterOnly ? "!w-48 pb-6" : "!w-40 pb-6"}
            > {/* Adjust slide width based on view mode */}
              <FilmCard film={film} cardSize={isPosterOnly ? 'poster' : 'compact'} />
            </SwiperSlide>
          ))}
          {/* Conditionally render AllFilmsCard */}
          {appendAllFilmsCard && (
            <SwiperSlide style={{ width: 'auto' }} className={isPosterOnly ? "!w-48" : "!w-36"}> {/* Set slide width */}
              <AllFilmsCard cardSize={actualCardSize} />
            </SwiperSlide>
          )}
        </Swiper>
      ) : (
        // --- Grid Layout (Default ---
        <div className={`grid ${gridClasses} ${gapClass}`}>
          {/* ... grid items ... */}
          {films.map((film) => (
            <FilmCard key={film.imdbID} film={film} cardSize={actualCardSize} />
          ))}
          {appendAllFilmsCard && (
            <AllFilmsCard cardSize={actualCardSize} />
          )}
        </div>
      )}
    </div>
  );
};

export default FilmList;