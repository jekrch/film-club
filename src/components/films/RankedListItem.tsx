import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

import Markdown from '../common/Markdown';
import RowFrameWash from '../common/RowFrameWash';
import TrailerButton from '../common/TrailerButton';
import EntryDetailsPanel, { EntryDetailsToggle } from './EntryDetailsPanel';
import { ResolvedListEntry, ScoreSource } from '../../utils/listUtils';
import { entryFrameImage } from '../../utils/frameSources';
import { MAX_SCORE } from '../../utils/ratingEditUtils';
import { calculateClubAverage, getRatingColorClass } from '../../utils/ratingUtils';

interface RankedListItemProps {
    entry: ResolvedListEntry;
    /** False on an unranked list: the row keeps its place but loses its numeral. */
    ranked?: boolean;
    /** The list's owner, named in the score badge's tooltip. */
    owner?: string;
}

/** The club scores films out of 9, the same scale the film and profile pages use. */
const MAX_RATING = MAX_SCORE;

/** How a resolved score reads in the badge's tooltip, by where it came from. */
const SCORE_SOURCE_NOTE: Record<ScoreSource, string> = {
    entry: 'on this list',
    log: 'from their watch log',
    club: 'from their club rating',
};

/**
 * Height of the poster thumb, shared with the rank numeral's band so the two
 * center on each other. Keep them defined here together — a poster resized on
 * its own would silently knock the numeral off center.
 */
const POSTER_HEIGHT = 'h-[4.5rem]';

/**
 * The row's body is a grid rather than a flex row, for the note's sake alone.
 *
 * On a wide screen the note belongs beside the poster, in the title's column —
 * the numeral and poster span both rows to put it there. On a phone that column
 * is what's left of ~300px after a numeral band and a poster, about 170px, and
 * a note of any length came out as a ribbon of three-word lines. So there the
 * note drops to its own row across the full width, which a grid can express
 * with the same markup that a flex row would need two copies of.
 */
const BODY_GRID = 'grid grid-cols-[auto_auto_minmax(0,1fr)] items-start';
/** Column 1 and 2: beside the title on a phone, alongside the note above it. */
const SPANS_NOTE = 'row-start-1 sm:row-span-2';

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
const RankedListItem: React.FC<RankedListItemProps> = ({ entry, ranked = true, owner }) => {
    const { clubFilm, title, year, poster, rank, description, imdbID, score, scoreSource } = entry;
    const trailerKey = entry.resolvedTrailerKey;
    const { details } = entry;
    const [detailsOpen, setDetailsOpen] = useState(false);
    const panelId = `list-details-${imdbID}`;
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
        // `relative` and `overflow-hidden` are the wash's doing: it lays itself
        // over the row and has to be clipped to the rounded corners. Everything
        // after it is `relative` so it stacks above the art — a positioned
        // element paints over static siblings regardless of source order.
        <div className="group relative overflow-hidden rounded-xl border border-slate-600/30 bg-slate-700/25 py-3 pl-0 pr-3 sm:py-4 sm:pr-4 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45">
            <RowFrameWash image={entryFrameImage(entry)} />

            <div className={`relative ${BODY_GRID}`}>
                {/* Rank numeral, set oversized in the serif face for a magazine
                    feel. It owns the whole band between the row's left edge and
                    the poster — hence the row's `pl-0` and the absent column gap —
                    and centers in it both ways. The band is exactly the poster's
                    height rather than the row's: the poster is what the eye
                    lines the numeral up against, and a row's height varies with
                    the length of the note below, which would drift the numeral
                    down the longer the note ran. `tabular-nums` keeps the
                    figures on a common advance so the digits stay centered once
                    the list runs past 9.

                    `pb-[0.22em]` is an optical correction, not spacing:
                    centering aligns the line box, and a line box reserves
                    descender depth that figures never occupy, so the digits sit
                    low in it by about half that. Padding shrinks the content box
                    and lifts the digits by half its value — in `em`, so it holds
                    at both type sizes.

                    An unranked list keeps the band — the rows still have to line
                    up with each other — but narrows it to what a bullet needs
                    and drops the optical correction with the figures it was
                    correcting for. */}
                {ranked ? (
                    <span
                        className={`col-start-1 ${SPANS_NOTE} flex ${POSTER_HEIGHT} w-16 sm:w-24 select-none items-center justify-center pb-[0.22em] font-serif text-[2.5rem] sm:text-6xl font-normal tabular-nums leading-none tracking-tight text-slate-500/70 transition-colors duration-200 group-hover:text-amber-400/60`}
                    >
                        {rank}
                    </span>
                ) : (
                    <span
                        className={`col-start-1 ${SPANS_NOTE} flex ${POSTER_HEIGHT} w-8 sm:w-12 select-none items-center justify-center`}
                        aria-hidden="true"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500/70 transition-colors duration-200 group-hover:bg-amber-400/60" />
                    </span>
                )}

                {wrapLink(
                    poster && !posterFailed ? (
                        <img
                            src={poster}
                            alt={`${displayTitle} poster`}
                            loading="lazy"
                            decoding="async"
                            // `block`: an inline image sits on its line's
                            // baseline, and the descender space under it would
                            // make the link box taller than the poster — enough
                            // to throw the rank numeral beside it off center.
                            className={`block ${POSTER_HEIGHT} w-12 rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80`}
                            onError={() => setPosterFailed(true)}
                        />
                    ) : (
                        <span
                            className={`flex ${POSTER_HEIGHT} w-12 items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
                        >
                            ?
                        </span>
                    ),
                    `col-start-2 ${SPANS_NOTE} block`
                )}

                <div className="col-start-3 row-start-1 ml-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:ml-4">
                    {wrapLink(
                        // Wraps on a phone rather than truncating: the width left
                        // beside the numeral and poster can't hold much of a
                        // title, and the title is what the row is.
                        <h5 className="break-words font-medium text-slate-200 transition-colors group-hover:text-slate-100 sm:truncate">
                            {displayTitle}
                            {year && (
                                <span className="ml-1.5 font-normal text-slate-500">{year}</span>
                            )}
                            {!clubFilm && (
                                <ArrowTopRightOnSquareIcon
                                    className="ml-1.5 inline h-3 w-3 align-baseline text-slate-600"
                                    aria-hidden="true"
                                />
                            )}
                        </h5>,
                        'min-w-0'
                    )}

                    {(score !== null ||
                        clubAverage !== null ||
                        trailerKey !== null ||
                        details !== null) && (
                        <span className="ml-auto flex flex-shrink-0 items-center gap-1.5">
                            {/* Leads the cluster: it is the only thing here that
                                does something, and most list films have no page
                                on this site, so it is the one way to see the
                                film before going out to IMDb for it. */}
                            {trailerKey && (
                                <TrailerButton trailerKey={trailerKey} title={displayTitle} />
                            )}

                            {/* The owner's own score, wherever they gave it — on
                                this list, in their log, or in the club. All three
                                are the same person's opinion of the same film,
                                which is what a list row is for; the tooltip says
                                which one it is. */}
                            {score !== null && (
                                <span
                                    className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                    title={`${owner ?? 'Their'}${owner ? "'s" : ''} score: ${score}/${MAX_RATING}${
                                        scoreSource ? ` (${SCORE_SOURCE_NOTE[scoreSource]})` : ''
                                    }`}
                                >
                                    <span className={getRatingColorClass(score)}>{score}</span>
                                    <span className="text-slate-600">/{MAX_RATING}</span>
                                </span>
                            )}

                            {/* Labelled once there are two badges, since a club
                                average and one member's score are not the same
                                claim and read identically bare. */}
                            {clubAverage !== null && (
                                <span
                                    className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                    title={`Average club rating: ${clubAverage.toFixed(1)}/${MAX_RATING}`}
                                >
                                    {score !== null && (
                                        <span className="mr-1 text-[0.65rem] uppercase tracking-wider text-slate-600">
                                            club
                                        </span>
                                    )}
                                    <span className={getRatingColorClass(clubAverage)}>
                                        {clubAverage.toFixed(1)}
                                    </span>
                                    <span className="text-slate-600">/{MAX_RATING}</span>
                                </span>
                            )}

                            {/* Last in the cluster, where a control that changes
                                the row's own height belongs — the badges before
                                it are labels, and this is the thing that acts on
                                what is under them. */}
                            {details && (
                                <EntryDetailsToggle
                                    isOpen={detailsOpen}
                                    onToggle={() => setDetailsOpen((open) => !open)}
                                    title={displayTitle}
                                    panelId={panelId}
                                />
                            )}
                        </span>
                    )}
                </div>

                {description && (
                    <div className="col-start-1 col-span-3 row-start-2 ml-3 mt-1.5 prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-slate-300 sm:col-span-1 sm:col-start-3 sm:ml-4">
                        <Markdown>{description}</Markdown>
                    </div>
                )}
            </div>

            {/* Outside the grid and across the whole row: the film's own
                description, unlike the owner's note, isn't answering to the
                title's column. */}
            {details && detailsOpen && (
                <div className="relative">
                    <EntryDetailsPanel details={details} panelId={panelId} />
                </div>
            )}
        </div>
    );
};

export default RankedListItem;
