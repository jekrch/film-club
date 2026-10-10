import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';

import Button from '../common/Button';
import Markdown from '../common/Markdown';
import RowFrameWash from '../common/RowFrameWash';
import TrailerButton from '../common/TrailerButton';
import EntryDetailsPanel, { EntryDetailsToggle } from './EntryDetailsPanel';
import WatchedEntryEditor from './WatchedEntryEditor';
import LogResponses from '../responses/LogResponses';
import { logThreadId } from '../../types/responses';
import { entryFrameImage } from '../../utils/frameSources';
import { getRatingColorClass } from '../../utils/ratingUtils';
import { formatWatchDate, type ResolvedWatchedEntry } from '../../utils/watchedUtils';
import { MAX_SCORE } from '../../utils/ratingEditUtils';
import type { WatchedPatch } from '../../api/clubApi';

/** The scale the club scores on, which members use for their own watches too. */
const MAX_RATING = MAX_SCORE;

/**
 * The poster's box, at a poster's own 2:3.
 *
 * The row's left anchor, sized to read as artwork rather than an icon: 72x108
 * on a phone, 88x132 from `sm` up. Both must stay exact 2:3 — a poster off its
 * own ratio either letterboxes or crops the title off the top.
 */
const POSTER_CLASS = 'h-27 w-18 sm:h-33 sm:w-22';

/** The poster's cell in the row's grid, whichever element fills it. */
const POSTER_SLOT_CLASS = 'col-start-1 row-start-1 block sm:row-span-3';

interface WatchedFilmItemProps {
    entry: ResolvedWatchedEntry;
    /** Whose log this row is in. Names the thread its reactions and comments hang from. */
    owner: string;
    /** True for the log's owner (or an admin), who gets the edit affordance. */
    canEdit: boolean;
    /** Saves a patch of the changed fields. Resolves when the write lands. */
    onSave: (imdbID: string, patch: WatchedPatch) => Promise<void>;
    onRemove: (imdbID: string) => Promise<void>;
    /**
     * True for the row a link arrived at by name, which blooms a ring and lets
     * it fade — the arriving reader is scrolled here mid-log and needs to be
     * told which row that was, but nothing should look selected afterwards.
     */
    highlighted?: boolean;
}

/**
 * One dated row of a member's watch log: when they watched it, what they made
 * of it, and — for the owner — an editor for both.
 *
 * The club counterpart of this row is a film card on the films page; the
 * difference that matters is whose opinion the score is. Here it is one
 * person's, so it is never labelled an average and never drawn from
 * `clubRatings`, even when the club happens to have watched the same film.
 *
 * Where the row links depends on which side of the club divide the film falls:
 * one the club watched goes to its detail page (where the *club's* ratings
 * live), anything else goes out to IMDb, since a film with no club record has
 * no page on this site.
 */
const WatchedFilmItem: React.FC<WatchedFilmItemProps> = ({
    entry,
    owner,
    canEdit,
    onSave,
    onRemove,
    highlighted = false,
}) => {
    const { clubFilm, title, year, poster, imdbID, watchDate, blurb } = entry;
    // The resolved key — theirs if they set one, the film's otherwise, null if
    // they hid it — never the raw override this row's editor writes.
    const trailerKey = entry.resolvedTrailerKey;
    const { details } = entry;
    const [detailsOpen, setDetailsOpen] = useState(false);
    const panelId = `log-details-${imdbID}`;
    // A dead poster URL falls back to the empty frame rather than swapping
    // `src`, which can re-fire the handler forever. Same reasoning as
    // `RankedListItem`: cache-only films are OMDB rows nobody vetted.
    const [posterFailed, setPosterFailed] = useState(false);
    // The editor seeds itself from the entry each time it mounts, so a save
    // that landed elsewhere on the page is what shows when it opens again.
    const [editing, setEditing] = useState(false);

    const displayTitle = title ?? 'Unknown film';

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

    const posterArt =
        poster && !posterFailed ? (
            <img
                src={poster}
                alt={`${displayTitle} poster`}
                loading="lazy"
                decoding="async"
                className={`block ${POSTER_CLASS} rounded-md object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 transition-opacity hover:opacity-80`}
                onError={() => setPosterFailed(true)}
            />
        ) : (
            <span
                className={`flex ${POSTER_CLASS} items-center justify-center rounded-md bg-slate-800 text-[10px] uppercase tracking-widest text-slate-600 ring-1 ring-slate-600/40`}
            >
                ?
            </span>
        );

    return (
        // `relative` and `overflow-hidden` are the wash's doing: it lays itself
        // over the row and has to be clipped to the rounded corners. The blocks
        // below are `relative` so they stack above the art — a positioned
        // element paints over static siblings regardless of source order.
        <div
            className={`group relative overflow-hidden rounded-xl border border-slate-600/30 bg-slate-700/25 p-3 transition-colors duration-200 hover:border-blue-500/25 hover:bg-slate-700/45 sm:p-4${
                highlighted ? ' row-arrival' : ''
            }`}
        >
            {/* Not while the editor is open: the form is the whole row then, and
                art behind a date field and a textarea is just noise. */}
            {!editing && <RowFrameWash image={entryFrameImage(entry)} />}

            {/* A grid rather than a flex row, for the review's sake: on a wide
                screen it belongs beside the poster in the title's column, and on
                a phone that column is barely 200px, which turns a paragraph into
                a ribbon of three-word lines. Spanning the full width there is a
                change of placement, not of markup — which a flex row would need
                two copies of. */}
            {/* `grid-rows-[auto_1fr]` is what keeps the review still when it
                opens. The poster spans both rows, and when it is taller than
                they are, grid hands the surplus to every spanned auto track
                *equally* — so half of it lands in the title's row and pushes the
                review down. Open the review and the rows outgrow the poster,
                that half disappears, and the lines the reader was already
                looking at jump up by it. Naming the second track `1fr` sends the
                whole surplus there instead. Only from `sm`, which is where the
                poster starts spanning. The third track is the details toggle's,
                which that same surplus pushes down level with the poster's foot. */}
            <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start sm:grid-rows-[auto_1fr_auto]">
                {/* The poster opens the row's own details rather than leaving
                    for them — the title is still the way out. Only a row with
                    nothing to open falls back to the title's link. Inert while
                    the editor is open, since the panel is held shut then and a
                    click would only arm it to spring open on save. */}
                {details ? (
                    <button
                        type="button"
                        onClick={() => setDetailsOpen((open) => !open)}
                        disabled={editing}
                        aria-expanded={detailsOpen}
                        aria-controls={panelId}
                        aria-label={
                            detailsOpen
                                ? `Hide details for ${displayTitle}`
                                : `Show details for ${displayTitle}`
                        }
                        className={`${POSTER_SLOT_CLASS} rounded-md`}
                    >
                        {posterArt}
                    </button>
                ) : (
                    wrapLink(posterArt, POSTER_SLOT_CLASS)
                )}

                <div className="col-start-2 row-start-1 ml-3 min-w-0 sm:ml-4">
                    {/* The log is ordered by date, so the date leads the row as a
                        caption over the title, in the same place on every row. */}
                    <time
                        dateTime={watchDate}
                        className="block text-xs uppercase tracking-widest tabular-nums text-slate-500 transition-colors duration-200 group-hover:text-blue-300/80"
                    >
                        {formatWatchDate(watchDate)}
                    </time>

                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {wrapLink(
                            // Wraps on a phone rather than truncating: the title
                            // is what the row is, and a truncated one beside a
                            // poster leaves the reader guessing.
                            <h5 className="break-words font-medium text-slate-200 transition-colors group-hover:text-slate-100 sm:truncate">
                                {displayTitle}
                                {year && (
                                    <span className="ml-1.5 font-normal text-slate-500">
                                        {year}
                                    </span>
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

                        {/* Marks the overlap explicitly. Without it a club film
                            in a personal log reads as a club record, which is
                            the one confusion this feature has to avoid. */}
                        {clubFilm && (
                            <span className="flex-shrink-0 rounded-md bg-amber-400/[0.07] px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400/70 ring-1 ring-inset ring-amber-400/20">
                                Club film
                            </span>
                        )}

                        {/* Trailer and score travel together, so the pair moves
                            as one. On a phone they take a line of their own under
                            the title, left-aligned: pushed to the far edge they
                            landed stranded on whatever line the wrap left them,
                            and a two-line title left them floating in the middle
                            of the card. From `sm` there is room for them at the
                            end of the title's line. */}
                        {(entry.score !== null || trailerKey !== null) && (
                            <span className="mt-1 flex w-full flex-shrink-0 items-center gap-1.5 sm:ml-auto sm:mt-0 sm:w-auto">
                                {trailerKey && (
                                    <TrailerButton trailerKey={trailerKey} title={displayTitle} />
                                )}

                                {entry.score !== null && (
                                    <span
                                        className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-xs ring-1 ring-inset ring-white/[0.06]"
                                        title={`Their own rating: ${entry.score}/${MAX_RATING}`}
                                    >
                                        <span className={getRatingColorClass(entry.score)}>
                                            {entry.score}
                                        </span>
                                        {entry.scoreQualifier && (
                                            <span className="text-slate-400">
                                                {entry.scoreQualifier}
                                            </span>
                                        )}
                                        <span className="text-slate-500">/{MAX_RATING}</span>
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>

                {canEdit && !editing && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(true)}
                        aria-label={`Edit ${displayTitle}`}
                        className="col-start-3 row-start-1 ml-2 hover:text-blue-300"
                    >
                        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </Button>
                )}

                {/* Railed in emerald, the accent this codebase reserves for a
                    member's own voice (see `AccentCard`), and matching the note
                    on a list row. Without it the review and the film's own
                    tagline and synopsis in the panel below are the same grey at
                    the same size, a hairline apart. */}
                {blurb && !editing && (
                    <div className="col-span-3 col-start-1 row-start-2 mt-3 border-l-2 border-emerald-400/30 pl-3 prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-slate-300 sm:col-span-1 sm:col-start-2 sm:ml-4 sm:mt-1.5">
                        <Markdown>{blurb}</Markdown>
                    </div>
                )}

                {/* The row's foot: reactions and comments, with the Details
                    toggle at its right end. One line for both, in the grid's
                    third track, which from `sm` sits level with the poster's
                    foot and so usually costs the row no height at all. On a
                    phone it takes the full width under the review. Gone while
                    the editor is open, since the form is the row then. */}
                {!editing && (
                    <LogResponses
                        threadId={logThreadId(owner, imdbID)}
                        owner={owner}
                        title={displayTitle}
                        trailing={
                            details && (
                                <EntryDetailsToggle
                                    isOpen={detailsOpen}
                                    onToggle={() => setDetailsOpen((open) => !open)}
                                    title={displayTitle}
                                    panelId={panelId}
                                    labeled
                                />
                            )
                        }
                        className="col-span-3 col-start-1 row-start-3 mt-2 self-end sm:col-span-2 sm:col-start-2 sm:ml-4"
                    />
                )}
            </div>

            {/* Across the whole row rather than in the title's column: this is
                the film's own description, not the member's. Closed while the
                editor is open — the form is the row then. */}
            {details && (
                <div className="relative">
                    <EntryDetailsPanel
                        details={details}
                        panelId={panelId}
                        // Closed while the editor is open — the form is the row
                        // then — and it now closes the way it would have if the
                        // reader had done it, rather than vanishing.
                        open={detailsOpen && !editing}
                        title={displayTitle}
                        imdbID={imdbID}
                    />
                </div>
            )}

            {editing && (
                <WatchedEntryEditor
                    entry={entry}
                    title={displayTitle}
                    onSave={(patch) => onSave(imdbID, patch)}
                    onRemove={() => onRemove(imdbID)}
                    onClose={() => setEditing(false)}
                    className="relative mt-4 border-t border-slate-700/60 pt-4"
                />
            )}
        </div>
    );
};

export default WatchedFilmItem;
