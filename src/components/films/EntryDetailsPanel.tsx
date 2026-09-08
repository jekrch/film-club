import React, { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

import EntryPersonStrip from './EntryPersonStrip';
import FilmStills from './FilmStills';
import PlotParagraphs from './PlotParagraphs';
import { prefersReducedMotion } from '../../utils/motion';
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

/**
 * How long the open and the close each take. Mirrors the two keyframes in
 * `index.css`, which is what actually times them — this is how long the panel
 * has to be held in the tree for the close to finish playing.
 */
const DURATION_MS = 260;

/**
 * Keeps the panel in the tree for exactly as long as it is worth drawing, and
 * measures it at both ends so the keyframes have a height to work between.
 *
 * The panel is mounted when it opens and unmounted once it has closed — the
 * reason is on the component below — which is what makes this a hook rather
 * than two class names. A panel that is removed the instant it is closed cannot
 * animate out, so the unmount is held back until the close has played; nothing
 * else here is about the closed state, because by then the panel is gone.
 *
 * `useLayoutEffect` throughout rather than `useEffect`: each of these runs after
 * the panel is in the tree but before the browser paints, so a height is
 * readable and the animation is armed within the same frame. The reader never
 * sees the state it was measured from.
 */
const useOpenClose = (open: boolean) => {
    const ref = useRef<HTMLDivElement>(null);
    /** In the tree from the moment it opens until the close has finished. */
    const [mounted, setMounted] = useState(open);
    const [closing, setClosing] = useState(false);
    /** What the keyframes open to and close from, in pixels. */
    const [height, setHeight] = useState<number | null>(null);

    // Opening is immediate; the measurement below rides the same frame.
    useLayoutEffect(() => {
        if (!open) return;
        setClosing(false);
        setMounted(true);
    }, [open]);

    useLayoutEffect(() => {
        if (!open || !mounted) return;

        const element = ref.current;
        if (!element || prefersReducedMotion()) return;

        // Zero means nothing has laid out — a test environment, or a panel with
        // nothing in it. Animating to it would collapse the panel for a beat.
        const measured = element.scrollHeight;
        if (measured > 0) setHeight(measured);
    }, [open, mounted]);

    useLayoutEffect(() => {
        if (open || !mounted) return;

        // Measured again rather than reused from the open: the panel may have
        // grown since it opened — a headshot finished loading, or the window
        // narrowed and a line of prose wrapped — and a close that starts from a
        // stale height jumps before it moves.
        const element = ref.current;
        const measured = element?.scrollHeight ?? 0;
        // Nothing to play, so nothing to hold the unmount for. Same two cases
        // the open skips on, plus a reader who has asked for less motion.
        if (measured === 0 || prefersReducedMotion()) {
            setMounted(false);
            return;
        }

        setHeight(measured);
        setClosing(true);

        const timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
        }, DURATION_MS);
        return () => clearTimeout(timer);
    }, [open, mounted]);

    return { ref, mounted, closing, height };
};

interface EntryDetailsPanelProps {
    details: EntryDetails;
    panelId: string;
    /**
     * Whether the row is asking for the panel. Rendered unconditionally by its
     * callers and given this instead, because a panel removed the instant it is
     * closed has no way to animate out — see {@link useOpenClose}.
     */
    open: boolean;
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
 * In the tree only while it is open, plus the moment it takes to close. It is
 * cheap, but a hundred collapsed rows carrying a hundred hidden cast strips and
 * stills is a lot of `<img>` tags for a browser to work out it needn't fetch —
 * and on the wall, where forty rows sit on one page, it would also be forty
 * hidden panels' worth of links in the tab order. The cost is that it has to
 * measure itself at each end of the gesture rather than transition between two
 * resting states; {@link useOpenClose} is the whole of that.
 */
const EntryDetailsPanel: React.FC<EntryDetailsPanelProps> = ({
    details,
    panelId,
    open,
    title,
    imdbID,
}) => {
    const { ref, mounted, closing, height } = useOpenClose(open);

    if (!mounted) return null;

    return (
        // Two elements, because the height being animated and the panel's own
        // spacing cannot be the same box: a `max-height` of zero still paints a
        // border and still leaves a margin, so a single box would flash its top
        // rule into place before it had opened at all. The outer is the height,
        // the inner is the panel.
        //
        // `overflow-hidden` from the first render rather than only while the
        // animation runs, and it is load-bearing twice over. It clips what the
        // cap is hiding; and it makes this box a formatting context, so the
        // inner margin counts toward the height instead of collapsing out of it
        // — which it would do on the render the measurement is taken from,
        // leaving the animation ending a margin short of where the panel sits.
        <div
            id={panelId}
            ref={ref}
            className={`overflow-hidden${
                height === null ? '' : closing ? ' animate-details-close' : ' animate-details-open'
            }`}
            style={
                height === null
                    ? undefined
                    : ({ '--details-height': `${height}px` } as React.CSSProperties)
            }
        >
            <div className="mt-3 space-y-3 border-t border-slate-600/30 pt-3">
                {/* The tagline is the film's own marketing voice, so it is set
                    apart from the summary rather than run into it. */}
                {details.tagline && (
                    <p className="max-w-prose text-sm italic text-slate-400">{details.tagline}</p>
                )}

                {/* Held to a reading measure. A row is as wide as the page, and a
                    two-sentence synopsis set across the whole of it on a desktop
                    is one long line the eye has to travel end to end. */}
                {details.plot && (
                    <div className="max-w-prose space-y-2">
                        <PlotParagraphs
                            plot={details.plot}
                            className="text-sm leading-relaxed text-slate-300"
                            gapClassName=""
                        />
                    </div>
                )}

                {details.ratings.length > 0 && (
                    <EntryRatingChips ratings={details.ratings} imdbID={imdbID} />
                )}

                {details.stills.length > 0 && <FilmStills images={details.stills} title={title} />}

                {/* Crew before cast, as the film pages have them: who made it,
                    then who is in it. */}
                <EntryPersonStrip title="Crew" people={details.crew} />
                <EntryPersonStrip title="Cast" people={details.cast} />
            </div>
        </div>
    );
};

export default EntryDetailsPanel;
