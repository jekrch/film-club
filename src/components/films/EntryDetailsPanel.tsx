import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

import EntryPersonStrip from './EntryPersonStrip';
import FilmStills from './FilmStills';
import type { Rating } from '../../types/film';
import type { EntryDetails } from '../../utils/entryDetails';

interface EntryDetailsToggleProps {
    isOpen: boolean;
    onToggle: () => void;
    /** Named in the button's label, so a page of these is navigable by screen reader. */
    title: string;
    /** The panel's `id`, tying the two together for assistive tech. */
    panelId: string;
}

/**
 * The chevron that opens a row's panel, styled to sit beside the trailer badge.
 *
 * Exported separately from the panel because the two live in different cells of
 * a row's grid — the control belongs with the badges on the title line, the
 * panel spans the row underneath it.
 */
export const EntryDetailsToggle: React.FC<EntryDetailsToggleProps> = ({
    isOpen,
    onToggle,
    title,
    panelId,
}) => (
    <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isOpen ? `Hide details for ${title}` : `Show details for ${title}`}
        className="flex flex-shrink-0 items-center rounded-md bg-white/[0.04] px-1.5 py-0.5 text-slate-400 ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.08] hover:text-slate-100"
    >
        <ChevronDownIcon
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
        />
    </button>
);

/** What OMDB calls each source, and what a chip should say instead. */
const RATING_SOURCE_LABELS: Record<string, string> = {
    'Internet Movie Database': 'IMDb',
    'Rotten Tomatoes': 'Rotten Tomatoes',
    Metacritic: 'Metacritic',
};

/**
 * The external scores as chips, matching the film page's.
 *
 * The IMDb one links to the title page — the same target the row's own title
 * carries for a film the club never watched, which is where a reader goes next
 * anyway. The other two don't: OMDB gives a score, not a URL, and a guessed
 * Rotten Tomatoes slug is a 404 more often than it is a link.
 *
 * These are frozen at the moment CI fetched them; see the note on
 * `ListFilmSummary.ratings`.
 */
const EntryRatingChips: React.FC<{ ratings: Rating[]; imdbID: string }> = ({ ratings, imdbID }) => (
    <div className="flex flex-wrap gap-2">
        {ratings.map((rating) => {
            const label = RATING_SOURCE_LABELS[rating.source] ?? rating.source;
            const body = (
                <>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{rating.value}</span>
                </>
            );

            return rating.source === 'Internet Movie Database' ? (
                <a
                    key={rating.source}
                    href={`https://www.imdb.com/title/${imdbID}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-baseline gap-1.5 rounded-md bg-slate-700/60 px-2.5 py-1 ring-1 ring-yellow-500/30 transition hover:bg-slate-600/60 hover:ring-yellow-500/60"
                    title="View on IMDb"
                >
                    {body}
                </a>
            ) : (
                <span
                    key={rating.source}
                    className="inline-flex items-baseline gap-1.5 rounded-md bg-slate-700/60 px-2.5 py-1"
                    title={rating.source}
                >
                    {body}
                </span>
            );
        })}
    </div>
);

interface EntryDetailsPanelProps {
    details: EntryDetails;
    panelId: string;
    /** The film's title, for the stills lightbox heading. */
    title: string;
    /** Where the IMDb chip points. */
    imdbID: string;
}

/**
 * What a row knows about the film, opened out under it: tagline, summary,
 * credits, scores, stills, cast.
 *
 * This exists because most films on a list or in a watch log are ones the club
 * never watched, and those have no page on this site — the row was the whole of
 * what a reader got, and it said a title and a year. A club film's row can
 * expand too, from its own record, so the rows behave the same rather than one
 * kind having a chevron and the other not.
 *
 * Ordered the way someone deciding whether to watch something reads: what it
 * claims to be, what it is about, who made it, what it scored, then what it
 * looks like and who is in it.
 *
 * Mounted only while open. It is cheap, but a hundred collapsed rows carrying a
 * hundred hidden cast strips and stills is a lot of `<img>` tags for a browser
 * to work out it needn't fetch.
 */
const EntryDetailsPanel: React.FC<EntryDetailsPanelProps> = ({
    details,
    panelId,
    title,
    imdbID,
}) => (
    <div id={panelId} className="mt-3 space-y-3 border-t border-slate-600/30 pt-3 animate-fadeIn">
        {/* The tagline is the film's own marketing voice, so it is set apart
            from the summary rather than run into it. */}
        {details.tagline && (
            <p className="max-w-prose text-sm italic text-slate-400">{details.tagline}</p>
        )}

        {/* Held to a reading measure. A row is as wide as the page, and a
            two-sentence synopsis set across the whole of it on a desktop is one
            long line the eye has to travel end to end. */}
        {details.plot && (
            <p className="max-w-prose text-sm leading-relaxed text-slate-300">{details.plot}</p>
        )}

        {details.ratings.length > 0 && (
            <EntryRatingChips ratings={details.ratings} imdbID={imdbID} />
        )}

        {details.stills.length > 0 && <FilmStills images={details.stills} title={title} />}

        {/* Crew before cast, as the film pages have them: who made it, then who
            is in it. */}
        <EntryPersonStrip title="Crew" people={details.crew} />
        <EntryPersonStrip title="Cast" people={details.cast} />
    </div>
);

export default EntryDetailsPanel;
