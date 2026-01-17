import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film';
import { calculateClubAverage, getRatingColorClass } from '../../utils/ratingUtils';
import { CardSize } from '../../contexts/ViewSettingsContext';
import PopcornRating from '../common/PopcornRating';
import { UserIcon } from '@heroicons/react/20/solid';
import { GlobeEuropeAfricaIcon } from '@heroicons/react/24/solid';


interface FilmCardProps {
    film: Film;
    cardSize: CardSize;
}


const FilmCard: React.FC<FilmCardProps> = ({ film, cardSize }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const isCompact = cardSize === 'compact';
    const isPosterOnly = cardSize === 'poster';

    useEffect(() => {
        const currentRef = cardRef.current;
        if (!currentRef) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // Only update state when there's an actual change
                setIsVisible(prev => {
                    if (prev !== entry.isIntersecting) {
                        return entry.isIntersecting;
                    }
                    return prev;
                });
            },
            {
                threshold: 0.1,
                rootMargin: '50px'
            }
        );

        observer.observe(currentRef);

        return () => observer.disconnect();
    }, []);

    // Extract movie club info safely
    const clubRatings = film.movieClubInfo?.clubRatings;
    const selectorName = film.movieClubInfo?.selector;

    // Prepare rating entries, filtering out null or empty scores
    const ratingEntries = clubRatings
        ? clubRatings.filter(rating => rating.score !== null)
        : [];

    // Calculate club average rating
    const clubAverageDisplay = calculateClubAverage(clubRatings);

    // Format watch date for overlay (MM/DD/YY)
    const watchDateFormatted = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit'
        })
        : null;

    // Determine if the "Up Next" elements should be shown
    // True if there's no watch date BUT there is a selector assigned
    const showUpNext = !watchDateFormatted && selectorName;

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
                        ${isCompact || isPosterOnly ? 'text-xs -left-8 px-10 py-1 top-4 ' : ''} /* Smaller adjustments for compact view */
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
                    ${isPosterOnly ? 'border-slate-800' : ''}
                `}>
                    {/* Poster Container: Fixed aspect ratio, clips image */}
                    <div className={`relative w-full overflow-hidden ${isPosterOnly ? 'rounded-md' : 'rounded-t-md'}`} style={{ paddingBottom: '140%' /* Shorter aspect ratio */ }}>
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
                        
                        {/* Gradient overlay at the bottom of the poster - enhanced for text readability */}
                        <div className={`absolute inset-x-0 bottom-0 h-20 z-10 pointer-events-none ${!isPosterOnly ? 'bg-gradient-to-t from-black/70 via-black/30 to-transparent' : ''}`}></div>
                        
                        {/* Year badge positioned on the poster */}
                        {!isPosterOnly && film.year && (
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white/90 text-[11px] font-medium px-1.5 py-0.5 rounded z-20">
                                {film.year}
                            </div>
                        )}

                        {/* Selector and Date overlay at bottom of poster */}
                        {!isPosterOnly && (selectorName || watchDateFormatted) && (
                            <div className={`
                                absolute bottom-0 left-0 right-0 z-20
                                flex items-end justify-between
                                ${isCompact ? 'px-1.5 pb-1.5' : 'px-2 pb-2'}
                            `}>
                                {/* Selector badge - left side */}
                                {selectorName && (
                                    <div className={`
                                        flex items-center gap-1.5
                                        bg-black/60 backdrop-blur-sm
                                        text-white/95 font-semibold uppercase tracking-wider
                                        rounded shadow-lg
                                        ${isCompact ? 'text-[8px] px-1.5 py-0.5 gap-1' : 'text-[10px] px-2 py-1'}
                                    `}>
                                        <span className={`
                                            rounded-full flex-shrink-0 bg-emerald-400
                                            ${isCompact ? 'w-1 h-1' : 'w-1.5 h-1.5'}
                                        `}></span>
                                        <span>{selectorName}</span>
                                    </div>
                                )}
                                
                                {/* Watch date - right side */}
                                {watchDateFormatted && (
                                    <div className={`
                                        bg-black/60 backdrop-blur-sm
                                        text-white/80 font-monox tracking-wide rounded shadow-lg
                                        ${isCompact ? 'text-[9px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'}
                                        ${!selectorName ? 'ml-auto' : ''}
                                    `}>
                                        {watchDateFormatted}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Card Content Section: Below poster, contains text info - NOT shown in poster-only mode */}
                    {!isPosterOnly && (
                        <div className={`flex flex-col flex-grow ${isCompact ? 'p-1.5' : 'p-2'} bg-gradient-to-b from-slate-800 to-[#27364f] to-slate-700x rounded-b-md`}>
                            {/* Film Title */}
                            <h3 className={`
                                font-normal text-slate-200 truncate leading-tight tracking-wide
                                group-hover:text-blue-400 transition-colors duration-200
                                ${isCompact ? 'text-xs mb-1' : 'text-sm mb-1.5'}
                            `}>
                                {film.title}
                            </h3>

                            {/* Conditional Content Area: Ratings OR Film Info */}
                            <div className={`mt-auto ${isCompact ? '' : ''}`}>
                                {showUpNext ? (
                                    // --- RENDER IF "UP NEXT" ---
                                    <div className={`grid grid-cols-2 gap-x-2 gap-y-0.5 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                                        {/* Director */}
                                        {film.director && film.director !== "N/A" && (
                                            <div className="flex items-center text-slate-400 truncate col-span-2" title="Director">
                                                <UserIcon className={`mr-1 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
                                                <span className="truncate">{film.director.split(',')[0]}</span>
                                            </div>
                                        )}
                                        {/* Country */}
                                        {film.language && film.country !== "N/A" && (
                                            <div className="flex items-center text-slate-400 col-span-2" title="Country">
                                                <GlobeEuropeAfricaIcon className={`mr-1 text-slate-500 flex-shrink-0 ${isCompact ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} />
                                                <span className="text-slate-500 truncate">{film.country}</span>
                                            </div>
                                        )}
                                        {/* Fallback if no info */}
                                        {(!film.genre || film.genre === "N/A") && (!film.director || film.director === "N/A") && (!film.imdbRating || film.imdbRating === "N/A") && (
                                            <div className="text-slate-500 text-[10px] italic col-span-2">More info coming soon...</div>
                                        )}
                                    </div>
                                ) : (
                                    // --- RENDER IF WATCHED ---
                                    <>
                                        {/* Member Ratings Display */}
                                        {ratingEntries.length > 0 && (
                                            <div className={`flex flex-wrap items-stretch gap-1 ${isCompact ? 'gap-0.5' : 'gap-1'}`}>
                                                {ratingEntries.map((rating) => {
                                                    const numericRating = rating.score as number;
                                                    const ratingColorClass = getRatingColorClass(numericRating);
                                                    return (
                                                        <div
                                                            key={rating.user}
                                                            title={`${rating.user}: ${rating.score}/9`}
                                                            className={`
                                                                flex flex-col items-center justify-center flex-1 basis-0 min-w-0 max-w-10
                                                                text-center bg-white/5 rounded-sm shadow-inner shadow-black/20
                                                                transition-all duration-150 ease-out hover:bg-slate-600 hover:shadow-md
                                                                ${isCompact ? 'py-0.5' : 'py-1'}
                                                            `}
                                                        >
                                                            {/* Member Initials */}
                                                            <div className={`uppercase font-mono text-slate-400 leading-none tracking-wide whitespace-nowrap ${isCompact ? 'text-[8px]' : 'text-[9px]'}`}>
                                                                {rating.user.substring(0, 2)}
                                                            </div>
                                                            {/* Member Rating */}
                                                            <div className={`font-mono font-bold leading-none whitespace-nowrap mt-0.5 ${ratingColorClass} ${isCompact ? 'text-[11px]' : 'text-sm'}`}>
                                                                {rating.score}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Club Average Rating Display */}
                                        {false && clubAverageDisplay !== null && clubAverageDisplay !== undefined && ratingEntries.length > 0 && (
                                            <div className={`w-full flex items-center justify-end text-xs text-slate-400 mt-2 ${isCompact ? 'mt-1.5 text-[10px]' : 'mt-2 text-xs'}`}>
                                                <PopcornRating
                                                    rating={clubAverageDisplay as number}
                                                    maxRating={9}
                                                    size={isCompact ? 'small' : 'regular'}
                                                    showPartialFill={true}
                                                    title={`Average Club Rating: ${clubAverageDisplay?.toFixed(1)}/9`}
                                                    className="mr-auto opacity-70"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                        </div>
                    )}
                </div> {/* End Inner Card Div */}
            </Link>
        </div>
    );
};

export default FilmCard;