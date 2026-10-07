import React from 'react';
import { Link } from 'react-router-dom';
import CircularImage from './CircularImage';

/**
 * A trophy recipient's portrait and name, linking to their profile; `null` is a
 * sheet award nobody the club recognizes received. `children` trails the name
 * (the cabinet's tally count).
 *
 * Plain text rather than a chip: trophy lists carry a lot of names, and a pill
 * around each one inside an already-boxed tile is what made them read as clutter.
 */
const TrophyRecipient: React.FC<{ recipient: string | null; children?: React.ReactNode }> = ({
    recipient,
    children,
}) => {
    if (!recipient) {
        return (
            <span className="inline-flex min-w-0 items-center gap-2 text-sm italic text-slate-500">
                <span
                    className="h-6 w-6 flex-shrink-0 rounded-full border border-dashed border-slate-600"
                    aria-hidden="true"
                />
                Unattributed
                {children}
            </span>
        );
    }

    return (
        <Link
            to={`/profile/${encodeURIComponent(recipient)}`}
            className="group inline-flex min-w-0 items-center gap-2 text-sm text-slate-300 transition-colors duration-150 hover:text-amber-200"
            title={`View ${recipient}'s profile`}
        >
            <CircularImage alt={recipient} size="w-6 h-6" className="flex-shrink-0" />
            <span className="truncate">{recipient}</span>
            {children}
        </Link>
    );
};

export default TrophyRecipient;
