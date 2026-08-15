import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EyeIcon, PlusIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import { useClubAuth } from '../../auth/GoogleAuth';
import {
    formatWatchDate,
    formatWatchedScore,
    getWatchedForMember,
    resolveWatchedEntries,
} from '../../utils/watchedUtils';

interface ProfileWatchedSectionProps {
    /** Whose profile this is; the log is looked up and permission-checked on it. */
    owner?: string;
}

/** How many recent watches the preview lists before it defers to the full page. */
const PREVIEW_COUNT = 4;

/**
 * A teaser for a member's watch log — the few most recent films they watched
 * outside the club, linking through to `/watched/:memberName`.
 *
 * Renders nothing when the log is empty, so the page can include it
 * unconditionally — unless the viewer is the member themself, who needs
 * somewhere to start logging.
 *
 * These are not club films: they never enter `films.json` and contribute to no
 * statistic on this page. The section sits apart from the club-film sections
 * for exactly that reason.
 */
const ProfileWatchedSection: React.FC<ProfileWatchedSectionProps> = ({ owner }) => {
    const { configured, canEditAs } = useClubAuth();
    const canEdit = configured && canEditAs(owner);

    const entries = useMemo(() => getWatchedForMember(owner), [owner]);
    // Sliced before resolving: the log is already in watch order, and a member
    // with two hundred entries shouldn't pay for two hundred lookups to show
    // four rows.
    const preview = useMemo(
        () => resolveWatchedEntries(entries.slice(0, PREVIEW_COUNT)),
        [entries]
    );

    if (entries.length === 0 && !canEdit) return null;

    const watchedPath = `/watched/${encodeURIComponent(owner ?? '')}`;

    return (
        <AccentCard accent="blue" className="mb-8 p-6 md:p-10">
            <div className="mb-6 flex items-center gap-3">
                <EyeIcon className="h-5 w-5 text-blue-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Watched</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                {canEdit ? (
                    <Link
                        to={watchedPath}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                        <PlusIcon className="h-4 w-4" aria-hidden="true" />
                        Log a film
                    </Link>
                ) : (
                    <span className="whitespace-nowrap text-sm text-slate-400">
                        {entries.length} film{entries.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {entries.length === 0 ? (
                <p className="py-4 text-center italic text-slate-500">
                    You haven't logged anything you watched outside the club yet.
                </p>
            ) : (
                <>
                    <ul className="space-y-2">
                        {preview.map((entry) => (
                            <li key={entry.imdbID}>
                                <Link
                                    to={watchedPath}
                                    className="group flex items-center gap-4 rounded-xl border border-slate-600/30 bg-slate-700/25 px-4 py-3 transition-colors duration-200 hover:border-blue-500/25 hover:bg-slate-700/45"
                                >
                                    {entry.poster ? (
                                        <img
                                            src={entry.poster}
                                            alt=""
                                            loading="lazy"
                                            className="h-14 w-[2.4rem] flex-shrink-0 rounded object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40"
                                            onError={(e) => {
                                                e.currentTarget.style.visibility = 'hidden';
                                            }}
                                        />
                                    ) : (
                                        <span className="h-14 w-[2.4rem] flex-shrink-0 rounded bg-slate-800 ring-1 ring-slate-600/40" />
                                    )}

                                    <div className="min-w-0 flex-grow">
                                        <h5 className="truncate font-medium text-slate-200 transition-colors group-hover:text-slate-100">
                                            {entry.title ?? entry.imdbID}
                                            {entry.year && (
                                                <span className="ml-1.5 font-normal text-slate-500">
                                                    {entry.year}
                                                </span>
                                            )}
                                        </h5>
                                        <p className="mt-0.5 text-xs uppercase tracking-widest text-slate-500">
                                            {formatWatchDate(entry.watchDate)}
                                        </p>
                                    </div>

                                    {formatWatchedScore(entry) && (
                                        <span className="flex-shrink-0 font-mono text-sm text-slate-400">
                                            {formatWatchedScore(entry)}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {entries.length > preview.length && (
                        <Link
                            to={watchedPath}
                            className="mt-3 inline-block text-sm text-blue-400 transition-colors hover:text-blue-300"
                        >
                            All {entries.length} films watched →
                        </Link>
                    )}
                </>
            )}
        </AccentCard>
    );
};

export default ProfileWatchedSection;
