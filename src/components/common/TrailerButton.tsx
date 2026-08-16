import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
 * The film pages have had a trailer since the beginning; a list row and a watch
 * log row are where a member is most likely to meet a film they have never seen,
 * and until now those rows were the two surfaces that couldn't show one. This is
 * the pair of things every such row needs, kept together so a row only decides
 * *where* the button goes.
 *
 * The modal is portalled to `document.body` rather than left in the row. A row
 * clips itself to its rounded corners (`overflow-hidden`, for the art washed
 * behind it) and there are dozens of them stacked down a page — both of which a
 * full-screen overlay has to escape, and neither of which is the modal's
 * business to know about.
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

            {createPortal(
                <TrailerModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    trailerKey={trailerKey}
                    title={title}
                />,
                document.body
            )}
        </>
    );
};

export default TrailerButton;
