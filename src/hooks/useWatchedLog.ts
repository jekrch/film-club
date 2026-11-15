import { useCallback, useEffect, useState } from 'react';

import { ensureFilmSummaries } from '../api/filmSummaries';
import { fetchWatchedFiles, overlayPendingWatched } from '../api/repoData';
import { reconcile } from '../api/writeCache';
import { teamMembers } from '../types/team';
import { memberSlug, type WatchedEntry, type WatchedLog } from '../types/watched';

/** Every member on the roster, for the pages that show everyone's logs. */
export const ALL_MEMBERS: readonly string[] = teamMembers.map((member) => member.name);

/**
 * The last published copy of each member's log this page load has fetched, by
 * file name, before any overlay. What lets a page the reader comes back to
 * render at once, and refresh underneath.
 */
const fetched = new Map<string, WatchedEntry[]>();

const remembered = (owners: readonly string[]): WatchedLog | null => {
    const log: WatchedLog = {};
    for (const owner of owners) {
        const entries = fetched.get(memberSlug(owner));
        if (!entries) return null;
        log[owner] = entries;
    }
    return log;
};

/** The remembered copy with this tab's pending saves over it, or null if any is missing. */
const overlaid = (owners: readonly string[]): WatchedLog | null => {
    const files = remembered(owners);
    return files ? overlayPendingWatched(files, owners).log : null;
};

export interface WatchedLogState {
    /**
     * The members' logs, keyed by the names asked for, with this tab's own
     * unconfirmed saves laid over them. Null until the first fetch lands, unless
     * this page load has fetched them before.
     */
    log: WatchedLog | null;
    /** The first fetch failed and there is nothing remembered to show instead. */
    failed: boolean;
    /**
     * Re-applies this tab's pending saves without refetching. Call it after a
     * save has gone through `recordWrite`, and the new row shows at once.
     */
    reapply: () => void;
}

/**
 * The watch logs of the named members, fetched from the site (`data/watched/`).
 *
 * The logs aren't in the bundle. Each member's is one small file, so a page
 * fetches only the members it shows: one for a log page or a profile, the
 * whole roster for the wall.
 *
 * Before resolving, it also makes sure every film in them has a summary to
 * draw from. A film logged since the last full build is in the live index and
 * not in the bundle (`ensureFilmSummaries`), and without this the row would
 * render as "Unknown film" for everyone but the member who logged it.
 */
export function useWatchedLog(owners: readonly string[]): WatchedLogState {
    // The array is usually a fresh literal each render; the names are the key.
    const key = owners.join('\n');

    const [log, setLog] = useState<WatchedLog | null>(() => overlaid(owners));
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const names = key === '' ? [] : key.split('\n');
        const controller = new AbortController();
        setLog(overlaid(names));
        setFailed(false);

        fetchWatchedFiles(names, controller.signal)
            .then(async (files) => {
                const ids = Object.values(files).flatMap((entries) =>
                    entries.map((entry) => entry.imdbID)
                );
                await ensureFilmSummaries(ids);
                if (controller.signal.aborted) return;

                for (const [owner, entries] of Object.entries(files)) {
                    fetched.set(memberSlug(owner), entries);
                }
                const { log: next, source } = overlayPendingWatched(files, names);
                reconcile('watched', source);
                setLog(next);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    console.warn('Could not load watch logs:', error);
                }
                // A remembered copy stays on screen; only a page with nothing
                // at all reports the failure.
                setFailed(remembered(names) === null);
            });

        return () => controller.abort();
    }, [key]);

    const reapply = useCallback(() => {
        const names = key === '' ? [] : key.split('\n');
        setLog((current) => {
            const files = remembered(names);
            // Nothing fetched yet: lay the saves over what is showing, which
            // for a page still loading is nothing at all.
            return overlayPendingWatched(
                files ?? current ?? Object.fromEntries(names.map((name) => [name, []])),
                names
            ).log;
        });
    }, [key]);

    return { log, failed, reapply };
}

/** One member's entries out of a fetched log, matched case-insensitively. */
export const entriesFor = (log: WatchedLog | null, owner: string | undefined): WatchedEntry[] => {
    if (!log || !owner) return [];
    const normalized = owner.trim().toLowerCase();
    const key = Object.keys(log).find((name) => name.trim().toLowerCase() === normalized);
    return key === undefined ? [] : log[key];
};

/** Forgets every remembered log. For tests. */
export const resetWatchedLogs = (): void => fetched.clear();
