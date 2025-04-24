import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Film } from '../../types/film'; // Assuming types are correctly defined
import { calculateClubAverage } from '../../utils/ratingUtils'; // Assuming utils exist
import { CardSize } from '../../contexts/ViewSettingsContext'; // Assuming context exists


interface FilmCardProps {
    film: Film;
    cardSize: CardSize;
}

// Adjusted corner positions slightly if needed for smaller badges
const getCornerPositionClasses = (index: number): string => {
    switch (index) {
        case 0: return 'top-1 left-1'; // Adjusted slightly
        case 1: return 'top-1 right-1';
        case 2: return 'bottom-1 left-1';
        case 3: return 'bottom-1 right-1';
        default: return 'hidden';
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
            .slice(0, 4)
        : [];

    const clubAverageDisplay = calculateClubAverage(clubRatings);
    const watchedDateDisplay = film.movieClubInfo?.watchDate
        ? new Date(film.movieClubInfo.watchDate).toLocaleDateString('en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }) : null;

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
            {showUpNext && (
                <div
                    className={`
                        absolute top-0 left-40 transform -translate-x-3/4
                        -translate-y-1/2x rotate-[-4deg] // Position slightly above and rotate
                         bg-emerald-700 
                        text-white px-4 py-1.5 rounded z-10 // Styling
                        whitespace-nowrap // Prevent wrapping
                        pointer-events-none // Don't interfere with link clicks
                        transition-all duration-300 ease-out
                        group-hover:scale-105 group-hover:rotate-[-2deg] // Subtle hover effect
                        ${isCompact ? 'text-md px-3 py-1 !left-30' : 'text-2xl'}
                    `}
                    style={{ transformOrigin: 'center' }} // Ensure rotation is centered
                >
                    Up next from <span className="font-bold">{selectorName}</span>
                </div>
            )}

            {/* --- UP NEXT SELECTOR IMAGE --- */}
            {/* {showUpNext && (
                 <div
                    className={`
                        absolute -top-10 right-2
                        transform translate-x-[25%] translate-y-[25%] // Position slightly outside bottom-right
                        z-1 // Ensure it's above the card content
                        pointer-events-none // Don't interfere with link clicks
                        transition-transform duration-300 ease-out p-2 bg-emerald-500 rounded-full
                    ` + 
                    (isCompact ? '-top-[2em]' : '')}
                 >
                    <CircularImage
                        // Pass the actual selector image URL if you have it
                        // src={selectorImageUrl}
                        src={`/film-club/images/${selectorName?.toLowerCase()}.jpg`}
                        alt={selectorName}
                        // Adjust size based on cardSize
                        size={isCompact ? 'w-18 h-18' : 'w-28 h-28'}
                        // Add extra styling if needed
                        className="border-2 border-slate-400 "
                    />
                </div>
            )} */}

            {/* --- Original Card Structure --- */}
            <Link to={`/films/${film.imdbID}`} className="block h-full">
                {/* Add 'overflow-visible' IF the above absolute elements get clipped,
                    but be careful as it might affect internal layout. Usually better
                    to have the absolute elements as siblings like above. */}
                <div className={`
                    bg-slate-700 overflow-hidden h-full flex flex-col
                    border border-slate-700 group-hover:border-slate-600
                    transition-all duration-300 ease-in-out
                    shadow-md group-hover:shadow-lg shadow-slate-900/30
                    ${isCompact ? 'rounded-md' : 'rounded-lg'}
                    ${showUpNext ? 'pt-3 pb-3' : ''} // Add padding top/bottom if banner/image overlap too much content visually
                `}>
                    <div className="relative pb-[150%] overflow-hidden">
                        {/* Poster Image */}
                        <img
                            src={film.poster}
                            alt={`${film.title} poster`}
                            className={`
                                absolute top-0 left-0 w-full h-full object-cover
                                transform-gpu transition-transform duration-500 ease-out
                                group-hover:scale-105 group-hover:duration-300
                                ${isVisible ? 'scale-100' : 'scale-[0.97]'}
                            `}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }}
                        />

                        {/* Member ratings */}
                        {ratingEntries.map(([name, rating], index) => (
                            <div
                                key={name}
                                title={`${name}: ${rating}/9`}
                                className={`
                                    absolute ${getCornerPositionClasses(index)}
                                    bg-black/65 backdrop-blur-sm rounded flex items-baseline shadow-md
                                    pointer-events-none space-x-1
                                    ${isCompact
                                        ? 'px-1.5 py-0.5 text-xs'
                                        : 'px-2 py-1 text-sm space-x-1.5'
                                    }
                                `}
                            >
                                <span className={`
                                    font-semibold text-slate-300 uppercase leading-none tracking-wide
                                    ${isCompact ? 'text-[10px]' : 'text-xs'}
                                `}>
                                    {name.substring(0, 2)}
                                </span>
                                <span className={`
                                    font-bold text-white leading-none
                                    ${isCompact ? 'text-sm' : 'text-base'}
                                `}>
                                    {rating}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Card content section */}
                    <div className={`flex flex-col flex-grow ${isCompact ? 'p-2' : 'p-4'}`}>
                        <h3 className={`
                            font-semibold text-slate-100 mb-1 truncate
                            group-hover:text-blue-400 transition-colors duration-200
                            ${isCompact ? 'text-sm leading-tight' : 'text-base md:text-lg'}
                        `}>
                            {film.title}
                        </h3>

                        {!isCompact && film.director && film.director !== "N/A" && (
                            <span className="block text-xs text-slate-400 mt-0 mb-1 font-normal truncate" title={`Director: ${film.director}`}>
                                Dir: <span className="text-slate-300">{film.director}</span>
                            </span>
                        )}

                        {/* Selector info - now always shown if available, styling adjusted slightly */}
                        {selectorName && (
                            <div className={`
                                text-xs text-slate-500 truncate leading-tight
                                ${isCompact ? 'mt-0 mb-1' : 'mt-1 mb-2'}
                                ${showUpNext ? 'opacity-70' : ''} // Optionally dim if Up Next elements are shown
                            `}>
                                Selected by: <span className="text-slate-300 font-medium">{selectorName}</span>
                            </div>
                        )}

                        <div className={`
                            flex flex-wrap justify-between items-center gap-x-2 gap-y-1
                            text-slate-400 mt-auto
                            ${isCompact ? 'text-xs pt-1' : 'text-sm pt-2'}
                        `}>
                            {/* Year and Watch Date Container */}
                            <div className="flex items-center space-x-1.5">
                                <span>{film.year}</span>
                                {/* --- Show watch date only if it exists --- */}
                                {watchedDateDisplay && (
                                    <>
                                        <span className="text-slate-600 text-xs scale-90">•</span>
                                        <span title={`Watched: ${watchedDateDisplay}`}>{watchedDateDisplay}</span>
                                    </>
                                )}
                                {/* --- No else needed, hide if no date --- */}
                            </div>

                            {/* Club Average Rating */}
                            {clubAverageDisplay && (
                                <span className="flex items-center shrink-0" title="Average Club Rating">
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`text-blue-400 mr-0.5 flex-shrink-0 ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                    </svg>
                                    <span className={`font-medium text-slate-300 ${isCompact ? 'text-xs' : ''}`}>{clubAverageDisplay}</span>
                                    <span className={`ml-0.5 text-slate-500 ${isCompact ? 'text-xs' : ''}`}>/ 9</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
};

export default FilmCard;