import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import Markdown from '../components/common/Markdown';
import HeroBanner from '../components/common/HeroBanner';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import ErrorDisplay from '../components/common/ErrorDisplay';
import RankedListItem from '../components/films/RankedListItem';
import { getListById, resolveListEntries } from '../utils/listUtils';
import { isRankedList } from '../types/list';
import { entryFrameSource } from '../utils/frameSources';
import { getTeamMemberByName } from '../types/team';
import { useClubAuth } from '../auth/GoogleAuth';

/**
 * A single member-curated list, e.g. "Andy's Top 10 Horror Films".
 *
 * Reached only from its owner's profile. The films on it are mostly ones the
 * club never watched — see the segregation note in `types/list.ts` for why they
 * never enter `filmData`.
 */
const ListPage: React.FC = () => {
    const { listId } = useParams<{ listId: string }>();
    const navigate = useNavigate();
    const { configured, canEditAs } = useClubAuth();

    const list = getListById(listId);
    const entries = useMemo(() => (list ? resolveListEntries(list) : []), [list]);

    // Art for the banner, drawn from the whole list rather than just the films
    // the club happens to have watched: a member's own image link first, then
    // the club's stills, then the poster — whichever poster the row resolved to,
    // the member's own included. A list of two
    // or more films therefore always has a collage, which is the point — most
    // lists are films the club never watched.
    const collage = useMemo(() => entries.map(entryFrameSource), [entries]);

    if (!list) {
        return (
            <ErrorDisplay
                message={`List "${listId}" not found.`}
                backPath="/about"
                backButtonLabel="Back to About Page"
            />
        );
    }

    const owner = getTeamMemberByName(list.owner);
    const ranked = isRankedList(list);
    // `ol` is for a sequence whose numbering means something; `ul` is for one
    // that is merely in an order. Which of the two this list is, is the whole
    // distinction the `ranked` flag records.
    const Marker = ranked ? 'ol' : 'ul';

    return (
        <PageLayout>
            <Button onClick={() => navigate(-1)} variant="link" size="md" className="mb-8 group">
                <ChevronLeftIcon
                    className="h-5 w-5 transition-transform group-hover:-translate-x-1"
                    aria-hidden="true"
                />
                Back
            </Button>

            <HeroBanner sources={collage} className="mb-8">
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-amber-400/80">List</p>
                <h1 className="mb-3 break-words text-3xl font-thin text-slate-100 sm:text-4xl">
                    {list.name}
                </h1>
                <p className="text-slate-400">
                    by{' '}
                    {owner ? (
                        <Link
                            to={`/profile/${encodeURIComponent(owner.name)}`}
                            className="text-blue-400 transition-colors hover:text-blue-300"
                        >
                            {owner.name}
                        </Link>
                    ) : (
                        <span className="text-slate-300">{list.owner}</span>
                    )}
                </p>
                {list.description && (
                    <div className="prose prose-sm prose-invert mx-auto mt-4 max-w-none text-slate-300">
                        <Markdown>{list.description}</Markdown>
                    </div>
                )}
                {/* Only for the owner, and only once they have a session — which
                    they get from their own profile or a film page. */}
                {configured && canEditAs(list.owner) && (
                    <Link
                        to={`/lists/${list.id}/edit`}
                        className="mt-4 inline-flex items-center gap-1 text-sm text-amber-400 transition-colors hover:text-amber-300"
                    >
                        <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                        Edit this list
                    </Link>
                )}
            </HeroBanner>

            <AccentCard accent="amber" className="mb-12 p-3 sm:p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                    <h4 className="text-xl font-bold text-slate-100">
                        {entries.length} Film{entries.length !== 1 ? 's' : ''}
                    </h4>
                    <span className="h-px flex-grow bg-gradient-to-r from-amber-400/25 via-slate-700/60 to-transparent" />
                </div>

                {entries.length > 0 ? (
                    <Marker className="space-y-2">
                        {entries.map((entry) => (
                            <li key={`${entry.rank}-${entry.imdbID}`}>
                                <RankedListItem entry={entry} ranked={ranked} owner={list.owner} />
                            </li>
                        ))}
                    </Marker>
                ) : (
                    <p className="py-6 text-center italic text-slate-400">
                        This list doesn't have any films yet.
                    </p>
                )}
            </AccentCard>
        </PageLayout>
    );
};

export default ListPage;
