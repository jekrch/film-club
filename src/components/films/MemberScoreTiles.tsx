import React from 'react';

import { getRatingColorClass } from '../../utils/ratingUtils';
import { MAX_SCORE } from '../../utils/ratingEditUtils';
import type { ClubRating } from '../../types/film';

/**
 * How the club scored a film, one small tile per member: their initials over
 * the number they gave it, in the number's own color.
 *
 * Lifted out of {@link FilmCard}, which is where the shape was designed and is
 * still where most people meet it. The wall's screening rows draw the same
 * strip, and that is the whole reason this is a component rather than markup
 * inside the card: the card and the wall are two views onto the same row of
 * `films.json`, and a reader who learns "GA 8, JA 7.5" on a card should not
 * have to learn a second vocabulary for it three clicks away. Anything else
 * that wants to show a screening's scores at a glance should reach for this
 * rather than re-cut the tiles.
 *
 * Non-interactive by design — no links to the members it names. On the card
 * the whole surface is already one link to the film, and on the wall the row
 * is a sibling-of-links structure that has spent effort staying that way; the
 * names live in each tile's tooltip instead, where they cost nothing.
 *
 * Members who never scored the film are dropped rather than drawn empty: a
 * blank tile reads as a zero, and the club's sheet leaves scores out for all
 * sorts of reasons that aren't "they hated it".
 */
interface MemberScoreTilesProps {
    ratings: ClubRating[] | undefined;
    /** Tighter type and padding, for the compact card size and for the wall. */
    compact?: boolean;
    /**
     * True on a card, where the tiles divide the poster's width between them so
     * the strip reads as one band under the art. False on a row, where the
     * strip sits in a column of prose and stretching it would make three scores
     * look like a table.
     */
    stretch?: boolean;
    className?: string;
}

/** The tooltip for one tile: who, what they gave it, and what a qualifier means. */
const tileTitle = (rating: ClubRating): string => {
    const score = `${rating.user}: ${rating.score}/${MAX_SCORE}`;
    if (!rating.scoreQualifier) return score;
    const kind = rating.scoreQualifier === 'd' ? 'documentary' : 'qualified';
    return `${score} (${rating.scoreQualifier} — a ${kind} score; see the film page)`;
};

const MemberScoreTiles: React.FC<MemberScoreTilesProps> = ({
    ratings,
    compact = false,
    stretch = false,
    className = '',
}) => {
    const scored = (ratings ?? []).filter(
        (rating) =>
            rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score)
    );

    if (scored.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-stretch gap-1 ${className}`}>
            {scored.map((rating) => (
                <div
                    key={rating.user}
                    title={tileTitle(rating)}
                    className={`
                        flex flex-col items-center justify-center min-w-0 max-w-10
                        text-center bg-white/[0.04] rounded-md ring-1 ring-inset ring-white/[0.06]
                        transition-colors duration-150 ease-out hover:bg-white/[0.08]
                        ${stretch ? 'flex-1 basis-0' : 'w-10 flex-shrink-0'}
                        ${compact ? 'py-0.5' : 'py-1'}
                    `}
                >
                    {/* Member Initials */}
                    <div
                        className={`uppercase font-mono text-slate-400 leading-none tracking-widest whitespace-nowrap ${compact ? 'text-[8px]' : 'text-[9px]'}`}
                    >
                        {rating.user.substring(0, 2)}
                    </div>
                    {/* Member Rating */}
                    <div
                        className={`font-mono font-bold leading-none whitespace-nowrap mt-0.5 ${getRatingColorClass(rating.score as number)} ${compact ? 'text-[11px]' : 'text-sm'}`}
                    >
                        {rating.score}
                        {rating.scoreQualifier && (
                            <span className="align-super text-[0.6em] text-amber-400/90 lowercase">
                                {rating.scoreQualifier}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MemberScoreTiles;
