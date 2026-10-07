import React from 'react';
import { Link } from 'react-router-dom';
import CircularImage from '../common/CircularImage';

interface SelectorPickBadgeProps {
    /** The member who picked the film, already capitalized. */
    name: string;
    /**
     * Which of this member's picks the film is, counted by watch date. Omitted
     * for a film the club hasn't watched yet, which has no place in the order.
     */
    pickNumber?: number | null;
}

// The two punched notches at the ticket's ends. A mask rather than a pair of
// page-colored circles, so the notch shows whatever is actually behind it.
const NOTCH_RADIUS = 5;
const TICKET_MASK = [
    `radial-gradient(circle at 0 50%, transparent ${NOTCH_RADIUS}px, #000 ${NOTCH_RADIUS + 0.5}px) left / 51% 100% no-repeat`,
    `radial-gradient(circle at 100% 50%, transparent ${NOTCH_RADIUS}px, #000 ${NOTCH_RADIUS + 0.5}px) right / 51% 100% no-repeat`,
].join(', ');

const ordinal = (n: number): string => {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * The picker's portrait with an admission stub tucked against it. The stub is
 * set a few degrees off true, like one left on a table, and straightens when
 * the link is hovered.
 */
const SelectorPickBadge: React.FC<SelectorPickBadgeProps> = ({ name, pickNumber }) => (
    <Link
        to={`/profile/${encodeURIComponent(name)}`}
        className="group mt-6 flex flex-col items-center md:mt-0 md:ml-8 md:flex-shrink-0"
        title={`View ${name}'s profile`}
        aria-label={
            pickNumber
                ? `${name}'s ${ordinal(pickNumber)} pick — view profile`
                : `${name}'s pick — view profile`
        }
    >
        <div className="relative mb-4">
            <div className="rounded-full p-1 ring-1 ring-emerald-400/25 transition-colors duration-200 group-hover:ring-emerald-400/50">
                <CircularImage alt={name} size="w-32 h-32 md:w-36 md:h-36" />
            </div>
            {/* drop-shadow on the wrapper, not box-shadow on the ticket: the
                mask would cut a box-shadow off along with the notches. */}
            <div
                className="absolute -bottom-3 left-[38%] rotate-[-4deg] drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-1deg] motion-reduce:transition-none"
                aria-hidden="true"
            >
                <div
                    className="flex items-stretch whitespace-nowrap bg-emerald-700 text-emerald-50"
                    style={{ mask: TICKET_MASK, WebkitMask: TICKET_MASK }}
                >
                    <div className="py-1.5 pl-3.5 pr-3 text-left leading-none">
                        <span className="block text-[9px] font-medium uppercase tracking-[0.22em] text-emerald-200/75">
                            Picked by
                        </span>
                        <span className="mt-1 block font-serif text-base italic">{name}</span>
                    </div>
                    {pickNumber ? (
                        <div className="flex flex-col items-center justify-center border-l border-dashed border-emerald-300/40 pl-2.5 pr-3.5 leading-none">
                            <span className="text-[8px] font-medium uppercase tracking-[0.2em] text-emerald-200/75">
                                No.
                            </span>
                            <span className="mt-1 font-serif text-sm tabular-nums">
                                {pickNumber}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    </Link>
);

export default SelectorPickBadge;
