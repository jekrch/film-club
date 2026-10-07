import React, { useState } from 'react';
import { FilmIcon } from '@heroicons/react/24/outline';
import { Film } from '../../types/film';

const FRAME = 'w-9 h-[54px] flex-shrink-0 rounded ring-1 ring-slate-600/40';

/**
 * A film's poster at list-row size, for the rows in the almanac's chart panels.
 * Decorative: the title always sits beside it. A film with no poster, or one
 * that fails to load, gets the film-strip placeholder the profile's rows use.
 */
const FilmPosterThumb: React.FC<{ film: Film }> = ({ film }) => {
    const [failed, setFailed] = useState(false);
    const hasPoster = film.poster && film.poster !== 'N/A' && !failed;

    return hasPoster ? (
        <img
            src={film.poster}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className={`${FRAME} object-cover shadow-sm shadow-black/40`}
        />
    ) : (
        <div
            className={`${FRAME} flex items-center justify-center bg-slate-700/50`}
            aria-hidden="true"
        >
            <FilmIcon className="h-5 w-5 text-slate-500" />
        </div>
    );
};

export default FilmPosterThumb;
