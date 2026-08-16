import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

import PageLayout from '../components/layout/PageLayout';
import HeroBanner from '../components/common/HeroBanner';
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import ErrorDisplay from '../components/common/ErrorDisplay';
import FilmSearchPicker from '../components/films/FilmSearchPicker';
import WatchedFilmItem from '../components/films/WatchedFilmItem';
import { useClubAuth } from '../auth/GoogleAuth';
import {
    deleteWatched,
    getWatched,
    putWatched,
    type FilmSearchResult,
    type WatchedPatch,
} from '../api/clubApi';
import { getTeamMemberByName } from '../types/team';
import type { WatchedEntry } from '../types/watched';
import { compareWatched, getWatchedForMember, resolveWatchedEntries } from '../utils/watchedUtils';
import { todayLocal } from '../utils/watchedEditUtils';
import { entryFrameSource } from '../utils/frameSources';

/**
 * One member's watch log: everything they watched on their own, most recent
 * first — the personal counterpart to the club's own history.
 *
 * These are **not** club films and never become them. The log lives in its own
 * file that no CI step folds into `films.json`, so nothing here reaches the
 * almanac, a club average, or any statistic; see the note at the top of
 * `types/watched.ts`. A film the club also watched may appear, marked as such,
 * and its two records stay separate: the club's on its film page, the member's
 * here.
 *
 * The page is public and read-only for everyone but the log's owner, who gets
 * the search box and the per-row editor once signed in.
 */
const WatchedPage: React.FC = () => {
    const { memberName } = useParams<{ memberName: string }>();
    const navigate = useNavigate();
    const { configured, status, member: signedInAs, canEditAs, withToken } = useClubAuth();

    const teamMember = getTeamMemberByName(memberName ?? '');
    /** The display name as `watched.json` keys it, not the URL's casing. */
    const owner = teamMember?.name;

    const [entries, setEntries] = useState<WatchedEntry[]>(() => getWatchedForMember(memberName));
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // A late live read must not overwrite a save made in the meantime, so
    // seeding checks this rather than the state it is about to replace.
    const touched = useRef(false);

    const canEdit = configured && canEditAs(owner);
    /** Set only when an admin is editing someone else's log; the worker defaults to the caller. */
    const actingFor = owner && signedInAs && owner !== signedInAs ? owner : undefined;

    // The bundle renders instantly and is right except for saves that haven't
    // deployed yet; the live copy from `main` is what makes logging two films a
    // minute apart behave (§8.8).
    useEffect(() => {
        if (status !== 'signed-in' || !owner) return;
        const controller = new AbortController();

        withToken((token) => getWatched(token, controller.signal))
            .then((log) => {
                if (controller.signal.aborted || touched.current) return;
                const key = Object.keys(log).find(
                    (name) => name.trim().toLowerCase() === owner.toLowerCase()
                );
                setEntries(key === undefined ? [] : [...log[key]].sort(compareWatched));
            })
            .catch(() => {
                // The bundled log is already on screen; a failed refresh means
                // it may be a minute stale, not that the page is broken.
            });

        return () => controller.abort();
    }, [status, owner, withToken]);

    const resolved = useMemo(() => resolveWatchedEntries(entries), [entries]);
    const logged = useMemo(() => new Set(entries.map((entry) => entry.imdbID)), [entries]);

    // Art for the banner, drawn from the whole log rather than just the films
    // the club happens to have watched: the member's own image link first, then
    // the club's stills, then the poster — whichever poster the row resolved to,
    // the member's own included. A log of two or
    // more films therefore always has a collage, which is the point — most of
    // what's logged here the club never watched.
    const collage = useMemo(() => resolved.map(entryFrameSource), [resolved]);

    /** Folds a written entry into local state, keeping the log in watch order. */
    const applyLocal = useCallback((entry: WatchedEntry) => {
        touched.current = true;
        setEntries((current) =>
            [...current.filter((existing) => existing.imdbID !== entry.imdbID), entry].sort(
                compareWatched
            )
        );
    }, []);

    const save = useCallback(
        async (imdbID: string, patch: WatchedPatch) => {
            const { entry } = await withToken((token) =>
                putWatched(token, imdbID, actingFor ? { ...patch, owner: actingFor } : patch)
            );
            applyLocal(entry);
            setNotice('Saved — live on the site in about a minute.');
            setError(null);
        },
        [withToken, actingFor, applyLocal]
    );

    const remove = useCallback(
        async (imdbID: string) => {
            await withToken((token) => deleteWatched(token, imdbID, actingFor));
            touched.current = true;
            setEntries((current) => current.filter((entry) => entry.imdbID !== imdbID));
            setNotice('Removed — live on the site in about a minute.');
            setError(null);
        },
        [withToken, actingFor]
    );

    /**
     * Logging from search is a one-click action: today's date, no score, no
     * review. Rating it is the row editor's job, and making that a second step
     * is what keeps "I watched this" cheap enough to actually record.
     */
    const logFilm = async (hit: FilmSearchResult) => {
        setNotice(null);
        setError(null);
        try {
            await save(hit.imdbID, { watchDate: todayLocal() });
            setNotice(`Logged ${hit.title}. Add a score or review with the pencil.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed.');
        }
    };

    if (!teamMember || !owner) {
        return (
            <ErrorDisplay
                message={`No club member named "${memberName}".`}
                backPath="/about"
                backButtonLabel="Back to About Page"
            />
        );
    }

    const isOwnLog = signedInAs !== null && signedInAs.toLowerCase() === owner.toLowerCase();

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
                <p className="mb-3 text-xs uppercase tracking-[0.2em] text-blue-400/80">Watched</p>
                <h1 className="mb-3 break-words text-3xl font-thin text-slate-100 sm:text-4xl">
                    {owner}'s watch log
                </h1>
                <p className="text-slate-400">
                    Films {isOwnLog ? 'you' : owner} watched outside the club, newest first.{' '}
                    <Link
                        to={`/profile/${encodeURIComponent(owner)}`}
                        className="text-blue-400 transition-colors hover:text-blue-300"
                    >
                        Back to {isOwnLog ? 'your' : 'their'} profile
                    </Link>
                </p>
            </HeroBanner>

            <AccentCard accent="blue" className="mb-12 p-3 sm:p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                    <h4 className="text-xl font-bold text-slate-100">
                        {entries.length} Film{entries.length !== 1 ? 's' : ''}
                    </h4>
                    <span className="h-px flex-grow bg-gradient-to-r from-blue-400/25 via-slate-700/60 to-transparent" />
                </div>

                {/* Signing in happens in the nav and nowhere else; this only
                    points the owner of the log at it. */}
                {configured && !canEdit && status !== 'signed-in' && (
                    <div className="mb-6 border-b border-slate-700/60 pb-6">
                        <p className="text-sm text-slate-400">
                            Is this yours? Sign in from the menu to log a film, or to score and
                            review one.
                        </p>
                    </div>
                )}

                {canEdit && (
                    <div className="mb-6 border-b border-slate-700/60 pb-6">
                        <FilmSearchPicker
                            onPick={(hit) => void logFilm(hit)}
                            chosen={logged}
                            accent="blue"
                            label={actingFor ? `Log a film for ${owner}` : 'Log a film you watched'}
                            chosenLabel="logged"
                        />
                    </div>
                )}

                {notice && <p className="mb-4 text-sm text-emerald-300">{notice}</p>}
                {error && <p className="mb-4 text-sm text-rose-300">{error}</p>}

                {resolved.length > 0 ? (
                    <ol className="space-y-2">
                        {resolved.map((entry) => (
                            <li key={entry.imdbID}>
                                <WatchedFilmItem
                                    entry={entry}
                                    canEdit={canEdit}
                                    onSave={save}
                                    onRemove={remove}
                                />
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="py-6 text-center italic text-slate-400">
                        {canEdit
                            ? "Nothing logged yet. Search above to add the first film you've watched."
                            : `${owner} hasn't logged anything watched outside the club.`}
                    </p>
                )}
            </AccentCard>
        </PageLayout>
    );
};

export default WatchedPage;
