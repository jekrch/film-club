import PopcornRating from '../common/PopcornRating';
import { Link } from 'react-router-dom';
import React from 'react';
import CollapsibleContent from '../common/CollapsableContent';

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
    return (
        <div className="flex items-stretch space-x-4">
            <Link to={`/films/${blurbItem.filmId}`} className="flex-shrink-0 w-20 block">
                {' '}
                {/* Ensure Link can take full height */}
                <img
                    key={`poster-${blurbItem.filmId}`}
                    src={blurbItem.filmPoster}
                    alt={blurbItem.filmTitle}
                    className="w-full h-full object-cover rounded-md shadow-lg hover:opacity-80 transition-opacity"
                    onError={(e) => {
                        e.currentTarget.src = '/placeholder-poster.png';
                        e.currentTarget.onerror = null;
                    }}
                />
            </Link>

            <div className="flex-1 min-w-0 py-0.5">
                <div className="flex justify-between items-baseline mb-1 flex-wrap gap-x-2">
                    <div className="flex flex-col min-w-0 mr-2 flex-grow">
                        <Link to={`/films/${blurbItem.filmId}`} className="truncate">
                            <h5 className="text-md font-semibold text-slate-200 hover:text-blue-400 transition-colors">
                                {blurbItem.filmTitle}
                            </h5>
                        </Link>
                        {blurbItem.watchDate && (
                            <p className="mt-0.5 text-xs uppercase tracking-widest text-slate-500">
                                Watched {blurbItem.watchDate}
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

                <div className="mt-2 border-l-2 border-slate-500/50 pl-3">
                    <CollapsibleContent
                        buttonSize="sm"
                        lineClamp={3}
                        className="text-sm italic leading-relaxed text-slate-300"
                    >
                        {blurbItem.blurb}
                    </CollapsibleContent>
                </div>
            </div>
        </div>
    );
};

export default ProfileBlurbItem;
