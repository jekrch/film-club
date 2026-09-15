import React, { useState } from 'react';
import { PlayCircleIcon } from '@heroicons/react/20/solid';

import TrailerModal from './TrailerModal';

interface TrailerButtonProps {
    /** The YouTube key to play. Callers render nothing when they have none. */
    trailerKey: string;
    /** The film's title, for the modal heading and the button's label. */
    title: string;
    /** Extra classes for placement; the badge styling itself is fixed. */
    className?: string;
}

/**
 * A row's trailer affordance: a badge-sized play button and the modal it opens.
 *
 * Used by list rows and watch log rows. Kept together so a row only decides
 * *where* the button goes.
 *
 * Rows clip to their rounded corners (`overflow-hidden`), which a full-screen
 * overlay has to escape. Modal portals itself to `document.body`, so the row can
 * render it directly.
 */
const TrailerButton: React.FC<TrailerButtonProps> = ({ trailerKey, title, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Styled as a sibling of the score badges rather than as a Button:
                these rows read as a line of small chips, and a link-variant
                button among them sits on a different baseline and box. */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label={`Play the ${title} trailer`}
                className={`flex flex-shrink-0 items-center gap-1 rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400 ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.08] hover:text-slate-100 ${className}`}
            >
                <PlayCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Trailer
            </button>

            <TrailerModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                trailerKey={trailerKey}
                title={title}
            />
        </>
    );
};

export default TrailerButton;
