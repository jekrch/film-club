import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

import EntryCastStrip from './EntryCastStrip';
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

interface EntryDetailsPanelProps {
    details: EntryDetails;
    panelId: string;
}

/**
 * What a row knows about the film, opened out under it: tagline, summary, cast.
 *
 * This exists because most films on a list or in a watch log are ones the club
 * never watched, and those have no page on this site — the row was the whole of
 * what a reader got, and it said a title and a year. A club film's row can
 * expand too, from its own record, so the rows behave the same rather than one
 * kind having a chevron and the other not.
 *
 * Mounted only while open. It is cheap, but a hundred collapsed rows carrying a
 * hundred hidden cast strips is a hundred sets of headshot `<img>` tags for a
 * browser to work out it needn't fetch.
 */
const EntryDetailsPanel: React.FC<EntryDetailsPanelProps> = ({ details, panelId }) => (
    <div
        id={panelId}
        className="mt-3 space-y-3 border-t border-slate-600/30 pt-3 animate-fadeIn"
    >
        {/* The tagline is the film's own marketing voice, so it is set apart
            from the summary rather than run into it. */}
        {details.tagline && (
            <p className="text-sm italic text-slate-400">{details.tagline}</p>
        )}

        {details.plot && (
            <p className="text-sm leading-relaxed text-slate-300">{details.plot}</p>
        )}

        <EntryCastStrip cast={details.cast} />
    </div>
);

export default EntryDetailsPanel;
