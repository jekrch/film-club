import React from 'react';
import { Link } from 'react-router-dom';
import { QueueListIcon } from '@heroicons/react/24/outline';

import AccentCard from '../common/AccentCard';
import { FilmListDefinition } from '../../types/list';
import { resolveListEntries } from '../../utils/listUtils';

interface ProfileListsSectionProps {
    lists: FilmListDefinition[];
}

/** How many posters the stacked preview shows before it stops. */
const PREVIEW_COUNT = 5;

/**
 * A member's curated lists, shown only on their own profile. Renders nothing
 * when they have none, so the page can include it unconditionally.
 */
const ProfileListsSection: React.FC<ProfileListsSectionProps> = ({ lists }) => {
    if (lists.length === 0) return null;

    return (
        <AccentCard accent="amber" className="mb-8 p-6 md:p-10">
            <div className="mb-6 flex items-center gap-3">
                <QueueListIcon className="h-5 w-5 text-amber-400/80" />
                <h4 className="text-xl font-bold text-slate-100">Lists</h4>
                <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                <span className="whitespace-nowrap text-sm text-slate-400">
                    {lists.length} list{lists.length !== 1 ? 's' : ''}
                </span>
            </div>

            <div className="space-y-2">
                {lists.map((list) => {
                    // Resolved rather than raw so the preview can use whichever
                    // source knows the poster, and skip entries with none.
                    const preview = resolveListEntries(list)
                        .filter((entry) => entry.poster)
                        .slice(0, PREVIEW_COUNT);

                    return (
                        <Link
                            key={list.id}
                            to={`/lists/${list.id}`}
                            className="group flex items-center gap-4 rounded-xl border border-slate-600/30 bg-slate-700/25 px-4 py-3.5 transition-colors duration-200 hover:border-amber-500/25 hover:bg-slate-700/45"
                        >
                            <div className="min-w-0 flex-grow">
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
                            </div>

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
                        </Link>
                    );
                })}
            </div>
        </AccentCard>
    );
};

export default ProfileListsSection;
