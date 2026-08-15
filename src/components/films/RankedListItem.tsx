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
 * Height of the poster thumb, shared with the rank numeral's band so the two
 * center on each other. Keep them defined here together — a poster resized on
 * its own would silently knock the numeral off center.
 */
const POSTER_HEIGHT = 'h-[4.5rem]';

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
        <div className="group flex items-start rounded-xl border border-slate-600/30 bg-slate-700/25 py-3 pl-0 pr-3 sm:py-4 sm:pr-4 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45">
            {/* Rank numeral, set oversized in the serif face for a magazine
                feel. It owns the whole band between the row's left edge and the
                poster — hence the row's `pl-0` and the absent flex gap — and
                centers in it both ways. The band is exactly the poster's height
                rather than the row's: the poster is what the eye lines the
                numeral up against, and a row's height varies with the length of
                the note below, which would drift the numeral down the longer
                the note ran. `tabular-nums` keeps the figures on a common
                advance so the digits stay centered once the list runs past 9.

                `pb-[0.22em]` is an optical correction, not spacing: centering
                aligns the line box, and a line box reserves descender depth
                that figures never occupy, so the digits sit low in it by about
                half that. Padding shrinks the content box and lifts the digits
                by half its value — in `em`, so it holds at both type sizes. */}
            <span className={`flex ${POSTER_HEIGHT} w-16 sm:w-24 flex-shrink-0 select-none items-center justify-center pb-[0.22em] font-serif text-[2.5rem] sm:text-6xl font-normal tabular-nums leading-none tracking-tight text-slate-500/70 transition-colors duration-200 group-hover:text-amber-400/60`}>
                {rank}
            </span>

            {wrapLink(
                poster && !posterFailed ? (
                    <img
                        src={poster}
                        alt={`${displayTitle} poster`}
                        loading="lazy"
                        decoding="async"
                        // `block`: an inline image sits on its line's baseline,
                        // and the descender space under it would make the link
                        // box taller than the poster — enough to throw the rank
                        // numeral beside it visibly off center.
                        className={`block ${POSTER_HEIGHT} w-12 rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80`}
                        onError={() => setPosterFailed(true)}
                    />
                ) : (
                    <span className={`flex ${POSTER_HEIGHT} w-12 items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}>
                        ?
                    </span>
                ),
                'flex-shrink-0 block'
            )}

            <div className="ml-3 sm:ml-4 min-w-0 flex-grow">
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
