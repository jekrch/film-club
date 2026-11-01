import React from 'react';
import { Link } from 'react-router-dom';
import type { OffDocketNote } from '../../utils/wallUtils';

/**
 * A signed line of the tab, ruled off like a page of a logbook. The rule goes on
 * top because the last line showing changes with the width, and it shouldn't
 * leave a stray rule against the tab's bottom edge.
 */
const ROW =
    'grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline border-t border-slate-700/40 leading-5';

/**
 * The home page's small note about the log: a tab sliding out from under the
 * banner, with whoever has been watching something outside the club's own
 * selections signed on its lines.
 *
 * The log is a page of mostly unofficial films, so this stays deliberately quiet
 * beside the club's picks: no posters, scores or review words to compete with the
 * cards under it. The whole tab is one link because every part of it says the
 * same thing, and that leaves a phone one easy target.
 *
 * It wears the banner's own border and hangs from the banner's bottom edge, which
 * is why it has no top border of its own and cancels the banner's `mb-8`. The
 * width keeps it between the colonnade's shafts: on a phone their inner edges
 * stand 54px in from the container, so the `7.75rem` is that on both sides plus
 * a little air. Past `sm` the shafts only move outward and the cap takes over.
 *
 * From `sm` it stops centering and stands just inside the left shaft. The margins
 * are that shaft's inner edge at each of its widths (62px, then 104px at `lg` and
 * 125px at `xl`, see `usePillarWidth` and `CorinthianPillar`) plus 12-15px of air.
 *
 * The first two names always show, with a third signing at `md`. A title
 * truncates inside its own column, so a long one can never cost a member's name
 * or their count, which wears the "…more" blue because it is the same invitation.
 */
const OffDocketStrip: React.FC<{ notes: OffDocketNote[] }> = ({ notes }) => {
    if (notes.length === 0) return null;

    return (
        <Link
            to="/log"
            className="animate-off-docket-descend group mx-auto -mt-8 mb-0 block sm:ml-[4.625rem] lg:ml-[7.25rem] xl:ml-[8.75rem] w-[calc(100%-7.75rem)] max-w-xs rounded-b-lg border border-t-0 border-slate-700/60 bg-slate-800/30 px-3 pb-1.5 pt-2 shadow-[inset_0_8px_8px_-8px_rgba(0,0,0,0.45)] transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800/50"
        >
            <span className="flex items-baseline justify-between gap-2 pb-1">
                <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Off the docket
                </span>
                <span className="whitespace-nowrap text-xs text-blue-300/70 transition-colors duration-200 group-hover:text-blue-200 group-focus-visible:text-blue-200">
                    …more
                </span>
            </span>

            {notes.map((note, index) => (
                <span
                    key={note.member}
                    className={`${ROW} ${index > 1 ? 'hidden md:grid' : 'grid'}`}
                >
                    <span className="truncate text-[11px] text-slate-400">
                        {note.member}
                        <span className="sr-only">: </span>
                    </span>
                    <span className="truncate font-serif text-xs italic text-slate-300 transition-colors duration-200 group-hover:text-slate-100 group-focus-visible:text-slate-100">
                        {note.subject}
                    </span>
                    {note.more > 0 && (
                        <span className="pl-2 text-[10px] tabular-nums text-blue-300/70 transition-colors duration-200 group-hover:text-blue-200 group-focus-visible:text-blue-200">
                            <span aria-hidden="true">+{note.more}</span>
                            <span className="sr-only"> and {note.more} more</span>
                        </span>
                    )}
                </span>
            ))}
        </Link>
    );
};

export default OffDocketStrip;
