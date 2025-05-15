import PopcornRating from '../common/PopcornRating';
import { Link } from 'react-router-dom';
import React, { useState, useRef, useLayoutEffect } from 'react';


export interface ProfileReviewBlurb {
    filmId: string;
    filmTitle: string;
    filmPoster: string;
    blurb: string;
    score: number;
    watchDate?: string;
}

interface ProfileBlurbItemProps {
    blurbItem: ProfileReviewBlurb;
    maxRating: number;
}

const ProfileBlurbItem: React.FC<ProfileBlurbItemProps> = ({ blurbItem, maxRating }) => {
    const [isUserExpanded, setIsUserExpanded] = useState(false);
    const [isContentActuallyOverflowingWhenClamped, setIsContentActuallyOverflowingWhenClamped] = useState(false);
    const blurbTextRef = useRef<HTMLParagraphElement>(null);

    useLayoutEffect(() => {
        if (blurbTextRef.current) {
            if (isUserExpanded) {
                // If user has expanded, we don't need to re-check for overflow in clamped state.
            } else {
                // Not user expanded, so line-clamp-3 is active. Check for actual overflow.
                const el = blurbTextRef.current;
                setIsContentActuallyOverflowingWhenClamped(el.scrollHeight > el.clientHeight);
            }
        }
    }, [blurbItem.blurb, isUserExpanded]);

    const handleToggleExpand = () => {
        setIsUserExpanded(prev => !prev);
    };

    const showButton = (isContentActuallyOverflowingWhenClamped && !isUserExpanded) || isUserExpanded;

    return (
        <div className="flex items-stretch space-x-4"> {/* items-stretch for poster height */}
            <Link to={`/films/${blurbItem.filmId}`} className="flex-shrink-0 w-20 block"> {/* Ensure Link can take full height */}
                <img
                    // MODIFICATION 1: Add key to help prevent image distortion on resize
                    key={isUserExpanded ? `poster-expanded-${blurbItem.filmId}` : `poster-collapsed-${blurbItem.filmId}`}
                    src={blurbItem.filmPoster}
                    alt={blurbItem.filmTitle}
                    className="w-full h-full object-cover rounded-md shadow-lg hover:opacity-80 transition-opacity"
                    onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; e.currentTarget.onerror = null; }}
                />
            </Link>

            <div className="flex-1 min-w-0 py-0.5">
                <div className="flex justify-between items-baseline mb-1 flex-wrap gap-x-2">
                    <div className="flex flex-col min-w-0 mr-2 flex-grow">
                        <Link to={`/film/${blurbItem.filmId}`} className="truncate">
                            <h5 className="text-md font-semibold text-slate-200 hover:text-blue-400 transition-colors">
                                {blurbItem.filmTitle}
                            </h5>
                        </Link>
                        {blurbItem.watchDate && (
                            // Watch date now on its own line, removed ml-2, whitespace-nowrap, flex-shrink-0
                            <p className="text-xs text-slate-400 mt-0.5">
                                (Watched: {blurbItem.watchDate})
                            </p>
                        )}
                    </div>
                    {typeof blurbItem.score === 'number' && (
                        <PopcornRating
                            rating={blurbItem.score}
                            maxRating={maxRating}
                            size="small"
                            title={`${blurbItem.score}/${maxRating}`}
                            className="flex-shrink-0"
                        />
                    )}
                </div>

                <div className="bg-slate-700/60 p-3.5 rounded-md relative border-l-2 border-emerald-500/70 shadow-inner mt-2 text-sm">
                    <svg
                        className="absolute text-emerald-500/70 h-5 w-5 top-1.5 left-1.5 opacity-90"
                        style={{ transform: 'translateY(0px)' }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-10zm-14 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <p
                        ref={blurbTextRef}
                        className={`text-slate-300 italic ${!isUserExpanded ? 'line-clamp-3' : ''} pl-6`}
                    >
                        {blurbItem.blurb}
                    </p>
                    {showButton && blurbItem.blurb && blurbItem.blurb.trim() !== '' && (
                        <button
                            onClick={handleToggleExpand}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium mt-2 block ml-6"
                        >
                            {isUserExpanded ? 'Show Less' : 'Show More'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileBlurbItem;