import type { JSX } from 'react';

import { REACTIONS, twemojiFile } from './reactions';
import type { ReactionKey } from '../../types/responses';

/** One reaction's emoji, from `public/reactions`. Decorative: the control around it carries the label. */
export const ReactionEmoji = ({
    reaction,
    className,
}: {
    reaction: ReactionKey;
    className?: string;
}): JSX.Element => (
    <img
        src={`/reactions/${twemojiFile(REACTIONS[reaction].emoji)}`}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        className={className}
    />
);

/** The "add a reaction" mark: an outlined smiley with a plus, in the heroicon stroke. */
export const AddReactionGlyph = ({ className }: { className?: string }): JSX.Element => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <circle cx="10.5" cy="13.5" r="7" />
        <path d="M8 12h.01M13 12h.01" strokeWidth={2.25} />
        <path d="M7.75 15.25c1.5 1.75 4 1.75 5.5 0" />
        <path d="M19 2.5v5M16.5 5h5" />
    </svg>
);
