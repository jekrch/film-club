import React from 'react';
import { Link } from 'react-router-dom';
import { PencilSquareIcon, PlusIcon, QueueListIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import { useClubAuth } from '../../auth/GoogleAuth';
import { FilmListDefinition } from '../../types/list';
import { resolveListEntries } from '../../utils/listUtils';

interface ProfileListsSectionProps {
    lists: FilmListDefinition[];
    /** Whose profile this is, for the "these are yours to edit" check. */
    owner?: string;
}

/** How many posters the stacked preview shows before it stops. */
const PREVIEW_COUNT = 5;

/**
 * A member's curated lists, shown only on their own profile. Renders nothing
 * when they have none, so the page can include it unconditionally — unless the
 * viewer is the member themself, who needs somewhere to start their first list.
 *
 * The editing links are the profile's entry point into the list editor (§8.9).
 * They appear only for the owner (or an admin); everyone else sees the section
 * exactly as it was before editing existed.
 */
const ProfileListsSection: React.FC<ProfileListsSectionProps> = ({ lists, owner }) => {
    const { configured, canEditAs } = useClubAuth();
    const canEdit = configured && canEditAs(owner);

    if (lists.length === 0 && !canEdit) return null;

    return (
        <AccentCard accent="amber" className="mb-8 p-6 md:p-10">
            <div className="mb-6 flex items-center gap-3">
                <QueueListIcon className="h-5 w-5 text-amber-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Lists</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                {canEdit ? (
                    <Link
                        to="/lists/new"
                        className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-amber-400 transition-colors hover:text-amber-300"
                    >
                        <PlusIcon className="h-4 w-4" aria-hidden="true" />
                        New list
                    </Link>
                ) : (
                    <span className="whitespace-nowrap text-sm text-slate-400">
                        {lists.length} list{lists.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {lists.length === 0 && (
                <p className="py-4 text-center italic text-slate-500">
                    You haven't made a list yet.
                </p>
            )}

            <div className="space-y-2">
                {lists.map((list) => {
                    // Resolved rather than raw so the preview can use whichever
                    // source knows the poster, and skip entries with none.
                    const preview = resolveListEntries(list)
                        .filter((entry) => entry.poster)
                        .slice(0, PREVIEW_COUNT);

                    return (
                        // The edit link is a sibling of the card link rather than
                        // a child: an anchor inside an anchor is invalid, and the
                        // browser's own handling of it is not something to rely on.
                        <div
                            key={list.id}
                            className="group flex items-center gap-4 rounded-xl border border-slate-600/30 bg-slate-700/25 px-4 py-3.5 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45"
                        >
                            <Link to={`/lists/${list.id}`} className="min-w-0 flex-grow">
                                <h5 className="truncate font-medium text-slate-200 transition-colors group-hover:text-slate-100">
                                    {list.name}
                                </h5>
                                <p className="mt-0.5 text-xs uppercase tracking-widest text-slate-500">
                                    {list.entries.length} film{list.entries.length !== 1 ? 's' : ''}
                                </p>
                                {list.description && (
                                    // Plain text, not Markdown: this is a two-line
                                    // teaser and the full description renders on
                                    // the list page.
                                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">
                                        {list.description}
                                    </p>
                                )}
                            </Link>

                            {/* Overlapping posters in rank order. Later siblings
                                would paint over earlier ones, so the z-index
                                descends to keep the top-ranked poster on top of
                                the stack. */}
                            {preview.length > 0 && (
                                <div className="hidden flex-shrink-0 sm:flex" aria-hidden="true">
                                    {preview.map((entry, index) => (
                                        <img
                                            key={entry.imdbID}
                                            src={entry.poster ?? undefined}
                                            alt=""
                                            loading="lazy"
                                            style={{ zIndex: preview.length - index }}
                                            className={`relative h-14 w-[2.4rem] rounded object-cover object-top shadow-sm shadow-black/40 ring-1 ring-slate-600/40 ${index === 0 ? '' : '-ml-5'}`}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {canEdit && (
                                <Link
                                    to={`/lists/${list.id}/edit`}
                                    aria-label={`Edit ${list.name}`}
                                    title={`Edit ${list.name}`}
                                    className="flex-shrink-0 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-700/45 hover:text-amber-300"
                                >
                                    <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default ProfileListsSection;
