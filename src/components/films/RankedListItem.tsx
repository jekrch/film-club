import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

import { ResolvedListEntry } from '../../utils/listUtils';
import { calculateClubAverage, getRatingColorClass } from '../../utils/ratingUtils';

interface RankedListItemProps {
    entry: ResolvedListEntry;
}

/** The club scores films out of 9, the same scale the film and profile pages use. */
const MAX_RATING = 9;

/**
 * One numbered row of a member's list: rank numeral, poster thumb, title, and
 * the member's note about the pick.
 *
 * `FilmCard` can't stand in here — it requires a full {@link Film}, and most
 * list films are ones the club never watched, so all this has is a
 * {@link ResolvedListEntry}. A numbered row also reads better for a ranking
 * than a grid of posters does.
 *
 * Where the row links depends on which side of the club/list divide the film
 * falls on: a club film goes to its detail page and carries its club average, a
 * list-only film goes out to IMDb.
 */
const RankedListItem: React.FC<RankedListItemProps> = ({ entry }) => {
    const { clubFilm, title, year, poster, rank, description, imdbID } = entry;
    // A dead poster URL falls back to the same empty frame a poster-less entry
    // gets, rather than to a placeholder image. Swapping `src` on error is the
    // habit elsewhere in this codebase, but it can't stop a loop here: React
    // registers onError at the root, so clearing the element's own `onerror`
    // property removes nothing, and a fallback that also fails re-fires the
    // handler forever. Cache-only films are OMDB rows for films the club never
    // vetted, so dead poster URLs among them are a normal occurrence.
    const [posterFailed, setPosterFailed] = useState(false);
    const clubAverage = clubFilm ? calculateClubAverage(clubFilm.movieClubInfo?.clubRatings) : null;
    const displayTitle = title ?? 'Unknown film';

    // The poster and title share one target, so the anchor is built once and
    // wrapped around each rather than repeated with different elements.
    const wrapLink = (children: React.ReactNode, className: string) =>
        clubFilm ? (
            <Link to={`/films/${imdbID}`} className={className}>
                {children}
            </Link>
        ) : (
            <a
                href={`https://www.imdb.com/title/${imdbID}/`}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {children}
            </a>
        );

    return (
        <div className="group flex items-start gap-3 sm:gap-4 rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 sm:p-4 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45">
            {/* Rank numeral. Tabular figures so a column of ranks stays aligned
                once the list runs past single digits. */}
            <span className="w-8 sm:w-10 flex-shrink-0 pt-0.5 text-right font-mono text-2xl sm:text-3xl font-bold tabular-nums leading-none text-slate-600 transition-colors duration-200 group-hover:text-amber-400/70">
                {rank}
            </span>

            {wrapLink(
                poster && !posterFailed ? (
                    <img
                        src={poster}
                        alt={`${displayTitle} poster`}
                        loading="lazy"
                        decoding="async"
                        className="h-[4.5rem] w-12 rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80"
                        onError={() => setPosterFailed(true)}
                    />
                ) : (
                    <span className="flex h-[4.5rem] w-12 items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40">
                        ?
                    </span>
                ),
                'flex-shrink-0 block'
            )}

            <div className="min-w-0 flex-grow">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {wrapLink(
                        <h5 className="truncate font-medium text-slate-200 transition-colors group-hover:text-slate-100">
                            {displayTitle}
                            {year && <span className="ml-1.5 font-normal text-slate-500">{year}</span>}
                            {!clubFilm && (
                                <ArrowTopRightOnSquareIcon
                                    className="ml-1.5 inline h-3 w-3 align-baseline text-slate-600"
                                    aria-hidden="true"
                                />
                            )}
                        </h5>,
                        'min-w-0'
                    )}

                    {clubAverage !== null && (
                        <span
                            className="ml-auto flex-shrink-0 rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                            title={`Average club rating: ${clubAverage.toFixed(1)}/${MAX_RATING}`}
                        >
                            <span className={getRatingColorClass(clubAverage)}>{clubAverage.toFixed(1)}</span>
                            <span className="text-slate-600">/{MAX_RATING}</span>
                        </span>
                    )}
                </div>

                {description && (
                    <div className="prose prose-sm prose-invert mt-1.5 max-w-none text-sm leading-relaxed text-slate-300">
                        <ReactMarkdown>{description}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RankedListItem;
