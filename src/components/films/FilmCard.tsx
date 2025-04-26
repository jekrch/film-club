import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film'; // Assuming types are correctly defined
import { calculateClubAverage } from '../../utils/ratingUtils'; // Assuming utils exist
import { CardSize } from '../../contexts/ViewSettingsContext'; // Assuming context exists
import PopcornRating from '../common/PopcornRating';
import { getTeamMemberByName, getTeamMemberColorByName } from '../../types/team';
import classNames from 'classnames';


interface FilmCardProps {
    film: Film;
    cardSize: CardSize;
}

// Helper function to determine rating color class for individual scores
const getRatingColorClass = (rating: number): string => {
    const numericRating = parseFloat(rating as any); // Ensure rating is a number
    if (numericRating >= 6.5) {
        return 'text-green-400'; // rating-high equivalent
    } else if (numericRating >= 5.0) {
        return 'text-yellow-400'; // rating-medium equivalent
    } else {
        return 'text-red-400'; // rating-low equivalent
    }
};


const FilmCard: React.FC<FilmCardProps> = ({ film, cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact'; // Define once

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 }
        );
        const currentRef = cardRef.current;
        if (currentRef) observer.observe(currentRef);
        return () => { if (currentRef) observer.unobserve(currentRef) };
    }, []);

    const clubRatings = film.movieClubInfo?.clubRatings;
    const selectorName = film.movieClubInfo?.selector;

    const ratingEntries = clubRatings
        ? Object.entries(clubRatings)
            .filter(([, rating]) => rating != null && rating !== '')
            // No slice here, show all available ratings in the info section
        : [];

    const clubAverageDisplay = calculateClubAverage(clubRatings);

    const watchedDateDisplay = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', {
             month: 'short', day: 'numeric', year: '2-digit' // Match 'Nov 29 '22' format more closely
        }).replace(/\//g, "'") // Replace slashes with apostrophe
         .replace(',', '') // Remove comma
        : null;


    // Determine if the "Up Next" elements should be shown
    const showUpNext = !watchedDateDisplay && selectorName;
   
    return (
        <div
            ref={cardRef}
            className={`
                transition-opacity duration-500 ease-out
                ${isVisible ? 'opacity-100' : 'opacity-30'}
                relative group // Add relative positioning and group here for hover states if needed on new elements
            `}
        >
            {/* --- UP NEXT BANNER --- */}
            {/* Brought back the banner based on your request */}
            {showUpNext && (
                <div
                    className={`
                        absolute top-5 -left-9 bg-red-700 text-white text-sm font-bold uppercase
                        px-8 py-1.5 transform -rotate-45 origin-center shadow-lg z-30 text-center
                        transition-all duration-300 ease-out
                        group-hover:scale-105
                        ${isCompact ? 'text-xs -left-8 px-6 py-1' : ''}
                    `}
                >
                    UP NEXT
                </div>
            )}

            {/* --- Original Card Structure --- */}
            <Link to={`/films/${film.imdbID}`} className="block h-full">
                <div className={`
                    bg-[#0a0a0a] overflow-hidden h-full flex flex-col
                    border border-slate-600 rounded-md
                    shadow-xl hover:shadow-2xl shadow-black/50
                    transition-all duration-300 ease-in-out
                `}>
                    {/* Poster Container with Aspect Ratio */}
                    {/* This structure and styling are retained to fix the poster display */}
                    <div className="relative w-full overflow-hidden rounded-t-md" style={{ paddingBottom: '150%' /* 2:3 aspect ratio */ }}>
                         {/* Poster Image */}
                        <img
                            src={film.poster}
                            alt={`${film.title} poster`}
                            className={`
                                absolute inset-0 w-full h-full object-cover
                                transform-gpu transition-transform duration-500 ease-out
                                group-hover:scale-105 group-hover:duration-300
                                ${isVisible ? 'scale-100' : 'scale-[0.97]'}
                            `}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }} // Use a local placeholder if needed
                        />

                        {/* Gradient Overlay - Kept for blending */}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-800/80 to-transparent z-10"></div>

                        {/* Year Badge - Positioned on the poster */}
                        {film.year && (
                             <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded z-20 shadow-md">
                                {film.year}
                            </div>
                        )}

                    </div>

                    {/* Card content section (below poster) */}
                    <div className={`flex flex-col flex-grow p-3 ${isCompact ? 'p-2' : 'p-3'} bg-gradient-to-b from-slate-800 to-slate-700 rounded-b-md`}> {/* Added gradient and bottom rounding */}
                        <h3 className={`
                            font-normal text-slate-200 mb-2 truncate leading-tight tracking-wide
                            group-hover:text-blue-400 transition-colors duration-200
                            ${isCompact ? 'text-sm' : 'text-base'}
                        `}>
                            {film.title?.toUpperCase()} {/* Match uppercase in design */}
                        </h3>

                        {/* Meta Info (Selector and Date) */}
                         <div className={`flex items-center justify-between mb-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                             {/* Selector info - Restored simple badge style */}
                            {selectorName && (
                                 <div className={`
                                    text-white px-2 py-1 rounded-sm text-xs font-bold uppercase flex items-center shadow-sm
                                    ${isCompact ? 'px-1.5 py-0.5 text-[10px]' : ''}
                                    bg-slate-700 
                                    `}>
                                    <span className={`
                                            w-1.5 h-1.5 bg-whited rounded-full mr-1 inline-block  
                                            ${getTeamMemberColorByName(selectorName) ? ` bg-${getTeamMemberColorByName(selectorName)} ` : 'bg-slate-700'}
                                        `}
                                    ></span> {/* Selector icon */}
                                    <span>{selectorName}</span>
                                </div>
                            )}
                             {/* Watch Date - Restored position */}
                             {watchedDateDisplay && (
                                <span className="text-slate-500 tracking-wide">
                                     {watchedDateDisplay}
                                </span>
                             )}
                        </div>


                        {/* Member ratings - Moved back into the info section */}
                        {ratingEntries.length > 0 && (
                            // Added flex-wrap and gap, ensuring items shrink to fit on one line if space is tight
                            <div className={`flex flex-wrap items-baseline gap-1.5 mt-auto pt-0 border-t border-slate-700 ${isCompact ? 'text-xs pt-0 border-t-slate-800' : 'text-sm pt-0 border-t-slate-700'}`}> {/* Added top border and padding */}
                                {ratingEntries.map(([name, rating], index) => {
                                    const numericRating = parseFloat(rating as string); // Ensure rating is a number for color class
                                    const ratingColorClass = getRatingColorClass(numericRating);
                                    return (
                                        <div
                                            key={name}
                                            title={`${name}: ${rating}/9`}
                                            className={`
                                                flex flex-col items-center justify-center flex-1 basis-0 min-w-0 // flex-1, basis-0, min-w-0 help items shrink
                                                text-center bg-white/5 rounded-sm py-1 shadow-inner shadow-black/20
                                                transition-transform duration-150 ease-out hover:bg-slate-600
                                                ${isCompact ? 'py-0.5' : 'py-1'}
                                            `}
                                        >
                                             <div className={`uppercase font-mono text-slate-300 leading-none tracking-wide whitespace-nowrap ${isCompact ? 'text-[14px]' : 'text-sm'}`}> {/* Font size increased, nowrap added */}
                                                {name.substring(0, 2)}
                                            </div>
                                            <div className={`font-mono font-bold text-white leading-none whitespace-nowrap ${ratingColorClass} ${isCompact ? 'text-sm' : 'text-smd'}`}> {/* Font size adjusted, nowrap added */}
                                                {rating}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                         {/* Club Average Rating - Displayed using PopcornRating component */}
                         {clubAverageDisplay !== null && clubAverageDisplay !== undefined && ( // Ensure average exists
                            <div className={`w-full flex items-center justify-end text-xs text-slate-400 mt-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                 {/* Using the PopcornRating component */}
                                 <PopcornRating
                                     rating={clubAverageDisplay}
                                     maxRating={9} // Assuming max rating is 9
                                     size={isCompact ? 'small' : 'regular'} // Adjust size based on card size
                                     showPartialFill={true}
                                     title={`Average Club Rating: ${clubAverageDisplay}/9`}
                                     className="mr-auto"
                                 />
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default FilmCard;