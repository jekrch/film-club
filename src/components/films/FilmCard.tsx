import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film'; // Assuming types are correctly defined
import { calculateClubAverage } from '../../utils/ratingUtils'; // Assuming utils exist
import { CardSize } from '../../contexts/ViewSettingsContext'; // Assuming context exists
import PopcornRating from '../common/PopcornRating';
import { getTeamMemberColorByName } from '../../types/team';
import { ClockIcon, UserIcon } from '@heroicons/react/20/solid';
// import { GlobeAltIcon } from '@heroicons/react/20/solid';
import { GlobeEuropeAfricaIcon } from '@heroicons/react/24/solid';


interface FilmCardProps {
    film: Film;
    cardSize: CardSize;
}

// Helper function to determine rating color class for individual scores
const getRatingColorClass = (rating: number | string): string => {
    // Ensure rating is treated as a number
    const numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;

    if (isNaN(numericRating)) {
        return 'text-slate-400'; // Default color for invalid ratings
    }

    if (numericRating >= 7) {
        return 'text-emerald-400'; // Green for 7 and above
    } else if (numericRating >= 4) {
        return 'text-yellow-500'; // Yellow for 4 up to (but not including) 7
    } else {
        return 'text-red-400'; // Red for ratings below 4 (0 to 3.99)
    }
};


const FilmCard: React.FC<FilmCardProps> = ({ film, cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact'; // Define once

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setIsVisible(entry.isIntersecting),
            { threshold: 0.1 } // Trigger when 10% of the card is visible
        );
        const currentRef = cardRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }
        // Cleanup observer on component unmount
        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []); // Empty dependency array means this effect runs once on mount

    // Extract movie club info safely
    const clubRatings = film.movieClubInfo?.clubRatings;
    const selectorName = film.movieClubInfo?.selector;

    // Prepare rating entries, filtering out null or empty strings
    const ratingEntries = clubRatings
        ? Object.entries(clubRatings)
            .filter(([, rating]) => rating != null && rating !== '')
        : [];

    // Calculate club average rating
    const clubAverageDisplay = calculateClubAverage(clubRatings);

    // Format watch date if available
    const watchedDateDisplay = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: '2-digit' // e.g., Apr 26 '25
        }).replace(/\//g, "'") // Replace slashes just in case (though format shouldn't have them)
         .replace('', '')     // Remove comma after day
        : null;


    // Determine if the "Up Next" elements should be shown
    // True if there's no watch date BUT there is a selector assigned
    const showUpNext = !watchedDateDisplay && selectorName;

    // Helper function to format Genre (display first genre)
    // const formatGenre = (genre: string) => {
    //     if (!genre) return 'N/A';
    //     return genre.split(',')[0].trim();
    // };

    return (
        // Outermost container: Handles visibility transition and relative positioning for the banner
        <div
            ref={cardRef}
            className={`
                transition-opacity duration-500 ease-out
                ${isVisible ? 'opacity-100' : 'opacity-30'}
                relative group rounded-md overflow-hidden  /* group allows hover states for children */
            `}
        >
            {/* --- UP NEXT BANNER (Larger, Emerald, Better Fit) --- */}
            {showUpNext && (
                <div
                    className={`
                        absolute top-[30px] -left-[40px] w-[10em] /* Position near top-left corner */
                        bg-gradient-to-r from-emerald-600 to-emerald-700 opacity-90 /* Emerald gradient */
                        text-white text-center /* Center text inside banner */
                        !text-lg font-bold uppercase tracking-wider /* Text styling */
                        px-10 py-1.5 /* Padding defines banner size */
                        transform -rotate-45 origin-center /* Rotation */
                        shadow-lg z-30 /* Elevation and stacking */
                        transition-all duration-300 ease-out /* Smooth transitions */
                        group-hover:scale-105 group-hover:shadow-xl /* Hover effects */
                        group-hover:from-emerald-500 group-hover:to-emerald-00 /* Hover colors */
                        ${isCompact ? 'text-xs -left-8 px-10 py-1 top-4' : ''} /* Smaller adjustments for compact view */
                    `}
                >
                    UP NEXT
                </div>
            )}

            {/* --- Link wraps the actual card content --- */}
            <Link to={`/films/${film.imdbID}`} className="block h-full">
                {/* Inner container: Defines card background, border, shadow, layout, and clips content */}
                <div className={`
                    bg-[#0a0a0a] overflow-hidden h-full flex flex-col
                    border border-slate-700 rounded-md
                    shadow-xl hover:shadow-2xl shadow-black/50
                    transition-all duration-300 ease-in-out
                `}>
                    {/* Poster Container: Fixed aspect ratio, clips image */}
                    <div className="relative w-full overflow-hidden rounded-t-md" style={{ paddingBottom: '140%' /* Shorter aspect ratio */ }}>
                        {/* Poster Image: Covers container, aligned top */}
                        <img
                            src={film.poster}
                            alt={`${film.title} poster`}
                            className={`
                                absolute inset-0 w-full h-full object-cover object-top /* Cover and align top */
                                transform-gpu transition-transform duration-500 ease-out
                                group-hover:scale-105 group-hover:duration-300 /* Hover zoom */
                                ${isVisible ? 'scale-100' : 'scale-[0.97]'} /* Initial scale state for transition */
                            `}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }} // Fallback image
                        />
                        {/* Gradient overlay at the bottom of the poster */}
                        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-800/10 to-transparent z-10"></div>
                        {/* Year badge positioned on the poster */}
                        {film.year && (
                                <div className="absolute top-2 right-2 bg-slate-800/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded z-20 shadow-md">
                                    {film.year}
                                </div>
                        )}
                    </div>

                    {/* Card Content Section: Below poster, contains text info */}
                    <div className={`flex flex-col flex-grow p-3 ${isCompact ? 'p-2' : 'p-3'} bg-gradient-to-b from-slate-800 to-[#27364f] to-slate-700x rounded-b-md`}>
                        {/* Film Title */}
                        <h3 className={`
                            font-normal text-slate-200 mb-2 truncate leading-tight tracking-wide
                            group-hover:text-blue-400 transition-colors duration-200
                            ${isCompact ? 'text-sm' : 'text-base'}
                        `}>
                            {film.title}
                        </h3>

                        {/* Meta Info Row: Selector and Date/Runtime */}
                         <div className={`flex items-center justify-between mb-0 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                            {/* Selector info badge */}
                            {selectorName && (
                                <div className={`
                                    text-slate-300 px-2 py-1 rounded-sm text-xs font-bold uppercase flex items-center shadow-sm flex-shrink-0 /* Prevent shrinking */
                                    ${isCompact ? 'px-1.5 py-0.5 text-[10px]' : ''}
                                    bg-slate-700
                                `}>
                                    {/* Colored dot based on team member */}
                                    <span className={`
                                            w-1.5 h-1.5 rounded-full mr-1.5 inline-block 
                                            ${getTeamMemberColorByName(selectorName) ? `bg-${getTeamMemberColorByName(selectorName)}` : 'bg-slate-500'} /* Fallback color */
                                        bg-slate-400`}
                                    ></span>
                                    <span>{selectorName}</span>
                                </div>
                             )}
                            {/* Watch Date OR Runtime (if Up Next) */}
                            {watchedDateDisplay ? (
                                 <span className="text-slate-500 tracking-wide ml-2 text-[10px]">
                                        {watchedDateDisplay}
                                 </span>
                             ) : film.runtime && film.runtime !== "N/A" ? (
                                <div className="flex items-center text-slate-400 ml-2" title="Runtime">
                                    <ClockIcon className={`w-3 h-3 mr-1 ${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                    <span className="text-xs tracking-wide">{film.runtime}</span>
                                </div>
                             ) : null /* Hide if no date and no runtime */}
                         </div>


                        {/* Conditional Content Area: Ratings OR Film Info */}
                        {/* This div grows to fill space and has top border */}
                        <div className={`mt-auto pt-0 border-t border-slate-700/50 ${isCompact ? 'pt-1' : 'pt-2'}`}>
                            {showUpNext ? (
                                // --- RENDER IF "UP NEXT" ---
                                <div className={`grid grid-cols-2 gap-x-2 gap-y-1 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                                    {/* Genre */}
                                    {/* {film.genre && film.genre !== "N/A" && (
                                        <div className="flex items-center text-slate-300 truncate" title="Genre">
                                             <FilmIcon className={`w-3 h-3 mr-1.5 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                             <span className="truncate">{formatGenre(film.genre)}</span>
                                        </div>
                                    )} */}
                                    {/* Director */}
                                    {film.director && film.director !== "N/A" && (
                                        <div className="flex items-center text-slate-300 truncate col-span-2" title="Director">
                                             <UserIcon className={`w-3 h-3 mr-1.5 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                             <span className="truncate">{film.director.split(',')[0]}</span> {/* Show first director */}
                                        </div>
                                    )}
                                    {/* IMDb Rating */}
                                    {film.language && film.country !== "N/A" && (
                                        <div className="flex items-center text-slate-300 col-span-2" title="IMDb Rating">
                                             <GlobeEuropeAfricaIcon className={`w-3 h-3 mr-1.5 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                             <span className="text-slate-500">{film.country}</span>
                                        </div>
                                    )}
                                    {/* Fallback if no info */}
                                    {(!film.genre || film.genre === "N/A") && (!film.director || film.director === "N/A") && (!film.imdbRating || film.imdbRating === "N/A") && (
                                        <div className="text-slate-500 text-xs italic col-span-2">More info coming soon...</div>
                                    )}
                                </div>
                            ) : (
                                // --- RENDER IF WATCHED ---
                                <>
                                    {/* Member Ratings Display */}
                                    {ratingEntries.length > 0 && (
                                        <div className={`flex flex-wrap items-stretch gap-1.5 ${isCompact ? 'gap-1 text-xs' : 'text-sm'}`}>
                                            {ratingEntries.map(([name, rating]) => {
                                                const numericRating = parseFloat(rating as string);
                                                const ratingColorClass = getRatingColorClass(numericRating); // Apply color based on rating
                                                return (
                                                    <div
                                                        key={name}
                                                        title={`${name}: ${rating}/9`}
                                                        className={`
                                                            flex flex-col items-center justify-center flex-1 basis-0 min-w-0 /* Flex properties for wrapping */
                                                            text-center bg-white/5 rounded-sm py-1 shadow-inner shadow-black/20
                                                            transition-all duration-150 ease-out hover:bg-slate-600 hover:shadow-md
                                                            ${isCompact ? 'py-0.5' : 'py-1'}
                                                        `}
                                                    >
                                                         {/* Member Initials */}
                                                         <div className={`uppercase font-mono text-[10px] text-slate-400 leading-none tracking-wide whitespace-nowrap ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>
                                                             {name.substring(0, 2)} {/* Show 3 initials */}
                                                         </div>
                                                         {/* Member Rating */}
                                                         <div className={`font-mono font-bold leading-none whitespace-nowrap mt-0.5 ${ratingColorClass} ${isCompact ? 'text-[12px]' : 'text-base'}`}>
                                                             {rating}
                                                         </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Club Average Rating Display */}
                                     {false && clubAverageDisplay !== null && clubAverageDisplay !== undefined && ratingEntries.length > 0 && ( // Only show if ratings exist
                                        <div className={`w-full flex items-center justify-end text-xs text-slate-400 mt-2 ${isCompact ? 'mt-1.5 text-[10px]' : 'mt-2 text-xs'}`}>
                                             {/* Popcorn component on the left */}
                                             <PopcornRating
                                                 rating={clubAverageDisplay as number}
                                                 maxRating={9} // Assuming max rating is 9
                                                 size={isCompact ? 'small' : 'regular'}
                                                 showPartialFill={true}
                                                 title={`Average Club Rating: ${clubAverageDisplay?.toFixed(1)}/9`}
                                                 className="mr-auto opacity-70" // Pushes popcorns left
                                             />
                                             {/* Explicit average number on the right */}
                                             {/* <span className="font-semibold text-slate-300">{clubAverageDisplay.toFixed(1)}</span>
                                             <span className="text-slate-500">/9</span> */}
                                         </div>
                                     )}
                                </>
                            )}
                        </div> {/* End Conditional Content Area */}

                    </div> {/* End Card Content Section */}
                </div> {/* End Inner Card Div */}
            </Link>
        </div> // End Outermost Div
    );
};

export default FilmCard;