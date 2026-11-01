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
 * Height of the poster, shared with the rank numeral's band so the two center
 * on each other. Keep them defined here together — a poster resized on its own
 * would silently knock the numeral off center.
 *
 * The wall's poster sizes, for the reason it has them: both rows give up width
 * to something on the poster's left, a timeline there and a numeral here. Width
 * is its own constant only because the numeral's band doesn't share it, and the
 * two must stay an exact 2:3 — a poster off its own ratio either letterboxes or
 * crops the title off the top.
 */
const POSTER_HEIGHT = 'h-21 sm:h-27';
const POSTER_WIDTH = 'w-14 sm:w-18';

/**
 * The row's body is a grid rather than a flex row, for the note's sake alone.
 *
 * On a wide screen the note belongs beside the poster, in the title's column —
 * the numeral and poster span the rows to put it there. On a phone that column
 * is what's left of ~300px after a numeral band and a poster, about 170px, and
 * a note of any length came out as a ribbon of three-word lines. So there the
 * note drops to its own row across the full width, which a grid can express
 * with the same markup that a flex row would need two copies of.
 */
/**
 * `grid-rows-[auto_1fr_auto]` is what keeps the note still when it opens. The
 * poster spans the rows, and when it is taller than they are, grid hands the
 * surplus to every spanned auto track *equally* — so part of it lands in the
 * title's row and pushes the note down. Open the note and the rows outgrow the
 * poster, that part disappears, and the lines the reader was already looking at
 * jump up by it. Naming the second track `1fr` sends the whole surplus there
 * instead: the title's row is only ever as tall as the title, and the prose
 * under it starts at the same place open or shut. Only from `sm`, which is where
 * the poster starts spanning. The third track is the details toggle's, which
 * that same surplus pushes down level with the poster's foot.
 */
const BODY_GRID =
    'grid grid-cols-[auto_auto_minmax(0,1fr)] items-start sm:grid-rows-[auto_1fr_auto]';
/** Column 1 and 2: beside the title on a phone, alongside the note above it. */
const SPANS_NOTE = 'row-start-1 sm:row-span-3';

/**
 * One row of a member's list: rank numeral, poster thumb, title, and the
 * member's note about the pick.
 *
 * `FilmCard` can't stand in here — it requires a full {@link Film}, and most
 * list films are ones the club never watched, so all this has is a
 * {@link ResolvedListEntry}. It is drawn as the wall's rows are instead, with
 * the numeral as the one thing they don't have, because a list's films are the
 * same kind of thing as a log's: a poster, somebody's score, and maybe their
 * words about it.
 *
 * Where the title links depends on which side of the club/list divide the film
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

    // The title and a poster with no details to open share one target, so the
    // anchor is built once and wrapped around each rather than repeated with
    // different elements.
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

    // The hover's opacity is on the slot rather than on this art, as the wall
    // has it, so the empty frame answers the cursor the same way a poster does.
    const posterArt =
        poster && !posterFailed ? (
            <img
                src={poster}
                alt={`${displayTitle} poster`}
                loading="lazy"
                decoding="async"
                // `block`: an inline image sits on its line's baseline, and the
                // descender space under it would make the slot taller than the
                // poster — enough to throw the rank numeral beside it off center.
                className={`block ${POSTER_HEIGHT} ${POSTER_WIDTH} rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40`}
                onError={() => setPosterFailed(true)}
            />
        ) : (
            <span
                className={`flex ${POSTER_HEIGHT} ${POSTER_WIDTH} items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
            >
                ?
            </span>
        );

    const posterSlotClass = `col-start-2 ${SPANS_NOTE} block rounded-md transition-opacity duration-200 hover:opacity-80`;

    return (
        // `relative` and `overflow-hidden` are the wash's doing: it lays itself
        // over the row and has to be clipped to the rounded corners. Everything
        // after it is `relative` so it stacks above the art — a positioned
        // element paints over static siblings regardless of source order.
        <div className="group relative overflow-hidden rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45 sm:p-4">
            <RowFrameWash image={entryFrameImage(entry)} />

            <div className={`relative ${BODY_GRID}`}>
                {/* Rank numeral, set oversized in the serif face for a magazine
                    feel, and centered both ways in its band. The band is exactly
                    the poster's height rather than the row's: the poster is what
                    the eye lines the numeral up against, and a row's height
                    varies with the length of the note below, which would drift
                    the numeral down the longer the note ran. `tabular-nums` keeps
                    the figures on a common advance so the digits stay centered
                    once the list runs past 9, and the band is wide enough to hold
                    the 100 a list can run to.

                    `pb-[0.22em]` is an optical correction, not spacing:
                    centering aligns the line box, and a line box reserves
                    descender depth that figures never occupy, so the digits sit
                    low in it by about half that. Padding shrinks the content box
                    and lifts the digits by half its value — in `em`, so it holds
                    at both type sizes.

                    An unranked list draws nothing here. Its column collapses and
                    the poster takes the row's left edge, as it does on the wall:
                    the rows line up with each other without a band to do it. */}
                {ranked && (
                    <span
                        className={`col-start-1 ${SPANS_NOTE} flex ${POSTER_HEIGHT} w-12 select-none items-center justify-center pb-[0.22em] font-serif text-3xl font-normal tabular-nums leading-none tracking-tight text-slate-500/70 transition-colors duration-200 group-hover:text-amber-400/60 sm:w-20 sm:text-5xl`}
                    >
                        {rank}
                    </span>
                )}

                {/* The poster opens the row's details in place, so a reader can
                    find out what a film is without leaving the list — most of
                    them have no page on this site, and the title is still the
                    way out. A row with nothing to open keeps the poster as the
                    title's link instead. The wall's arrangement. */}
                {details ? (
                    <button
                        type="button"
                        onClick={() => setDetailsOpen((open) => !open)}
                        aria-expanded={detailsOpen}
                        aria-controls={panelId}
                        aria-label={
                            detailsOpen
                                ? `Hide details for ${displayTitle}`
                                : `Show details for ${displayTitle}`
                        }
                        className={posterSlotClass}
                    >
                        {posterArt}
                    </button>
                ) : (
                    wrapLink(posterArt, posterSlotClass)
                )}

                <div className="col-start-3 row-start-1 ml-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1.5 leading-relaxed sm:ml-4">
                    {wrapLink(
                        // Wraps rather than truncating: the width left beside the
                        // numeral and poster can't hold much of a title, and the
                        // title is what the row is.
                        <h5 className="break-words">
                            {displayTitle}
                            {year && (
                                <span className="ml-1.5 font-normal text-slate-500">{year}</span>
                            )}
                            {!clubFilm && (
                                <ArrowTopRightOnSquareIcon
                                    className="ml-1 inline h-3 w-3 align-baseline text-slate-600"
                                    aria-hidden="true"
                                />
                            )}
                        </h5>,
                        'min-w-0 font-medium text-slate-200 decoration-slate-600 underline-offset-4 transition-colors hover:text-white hover:underline'
                    )}

                    {/* These travel together, so they move as one — the wall's
                        arrangement. On a phone they take a line of their own
                        under the title, left-aligned, rather than being pushed
                        to the far edge of whatever line the wrap left them on.
                        From `sm` they end the title's line. */}
                    {(score !== null || clubAverage !== null || trailerKey !== null) && (
                        <span className="flex w-full flex-shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto">
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
                                which one it is. Named on a wide screen, as the
                                wall names it, and on a phone left to that tooltip. */}
                            {score !== null && (
                                <span className="flex flex-shrink-0 items-baseline gap-1.5">
                                    {owner && (
                                        <span className="hidden text-[10px] uppercase tracking-widest text-slate-400 sm:inline">
                                            {owner}'s
                                        </span>
                                    )}
                                    <span
                                        className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                        title={`${owner ?? 'Their'}${owner ? "'s" : ''} score: ${score}/${MAX_RATING}${
                                            scoreSource
                                                ? ` (${SCORE_SOURCE_NOTE[scoreSource]})`
                                                : ''
                                        }`}
                                    >
                                        <span className={getRatingColorClass(score)}>{score}</span>
                                        <span className="text-slate-500">/{MAX_RATING}</span>
                                    </span>
                                </span>
                            )}

                            {/* Named at every width once there are two badges,
                                since a club average and one member's score are
                                not the same claim and read identically bare. */}
                            {clubAverage !== null && (
                                <span className="flex flex-shrink-0 items-baseline gap-1.5">
                                    <span
                                        className={`text-[10px] uppercase tracking-widest text-slate-400 ${
                                            score !== null ? '' : 'hidden sm:inline'
                                        }`}
                                    >
                                        Club avg
                                    </span>
                                    <span
                                        className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                        title={`Average club rating: ${clubAverage.toFixed(1)}/${MAX_RATING}`}
                                    >
                                        <span className={getRatingColorClass(clubAverage)}>
                                            {clubAverage.toFixed(1)}
                                        </span>
                                        <span className="text-slate-500">/{MAX_RATING}</span>
                                    </span>
                                </span>
                            )}
                        </span>
                    )}
                </div>

                {/* Railed in emerald, the accent this codebase reserves for a
                    member's own voice (see `AccentCard`). The details panel
                    below sets the film's tagline and synopsis in the same grey
                    at the same size, and with only a hairline between them the
                    owner's note read as more of the film's own copy. A rail is
                    as far as this goes — the reviews on a film page get a whole
                    card, but a list is a column of these and a column of cards
                    would bury the ranking. */}
                {description && (
                    <div className="col-span-3 col-start-1 row-start-2 mt-3 border-l-2 border-emerald-400/30 pl-3 prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-slate-300 sm:col-span-1 sm:col-start-3 sm:ml-4 sm:mt-1.5">
                        <Markdown>{description}</Markdown>
                    </div>
                )}

                {/* The box's bottom-right corner, labelled, rather than a bare
                    chevron among the badges on the title line, where it was easy
                    to read past — the wall's placement. */}
                {details && (
                    <EntryDetailsToggle
                        isOpen={detailsOpen}
                        onToggle={() => setDetailsOpen((open) => !open)}
                        title={displayTitle}
                        panelId={panelId}
                        labeled
                        className="col-start-3 row-start-3 mt-2 self-end justify-self-end"
                    />
                )}
            </div>

            {/* Outside the grid and across the whole row: the film's own
                description, unlike the owner's note, isn't answering to the
                title's column. */}
            {details && (
                <div className="relative">
                    <EntryDetailsPanel
                        details={details}
                        panelId={panelId}
                        open={detailsOpen}
                        title={displayTitle}
                        imdbID={imdbID}
                    />
                </div>
            )}
        </div>
    );
};

export default RankedListItem;
