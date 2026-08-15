import watchedData from '../assets/watched.json';

/**
 * Films members watched on their own, outside the club.
 *
 * This is the personal counterpart to `movieClubInfo`: the club watches a film
 * together, on a date, and everyone scores it; a member watches something by
 * themself, on a date, and scores it alone. The log reads in the same order the
 * club's own history does — most recent viewing first — which is the whole
 * reason it is a dated log rather than another kind of list.
 *
 * **A watch is never a club watch.** Nothing here is imported by `./film`, and
 * `apply_overrides.py` reads `overrides.json` only, so a logged film cannot
 * reach `films.json`, the almanac, the club average, or any statistic.
 * {@link WatchedEntry} is deliberately not `Film` or `Partial<Film>` — the same
 * structural guard `ListFilmSummary` uses — so an entry cannot be passed to a
 * component or stat function that takes club films.
 *
 * A member may log a film the club also watched. The two records coexist and
 * stay independent: the club rating lives in `films.json` (via `overrides.json`)
 * and counts toward club stats, while the entry here is one person's private
 * take and counts toward nothing. The film page shows the former; the watch log
 * shows the latter.
 */

/** One film a member watched. `null` means unset — there is no second writer to defer to. */
export interface WatchedEntry {
    imdbID: string;
    /** `YYYY-MM-DD`, so it sorts lexicographically. */
    watchDate: string;
    score: number | null;
    /** A single letter marking a different rubric, mirroring the club's `7.5d`. */
    scoreQualifier: string | null;
    /** Optional Markdown review. */
    blurb: string | null;
    updatedAt: string;
}

/** `watched.json`: member display name → their entries, newest watch first. */
export type WatchedLog = Record<string, WatchedEntry[]>;

/**
 * Validates the bundled log at module-load time.
 *
 * Same reasoning as `assertFilmData` and `assertListData`: this file is written
 * by the editor worker, so it is untyped at import and a malformed record would
 * otherwise surface as an opaque crash deep in a render. Intentionally shallow
 * — it checks the fields the page routes and sorts on, not the full schema (the
 * worker validates on write).
 */
function assertWatchedData(data: unknown): WatchedLog {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('watched.json: expected an object keyed by member name');
    }

    Object.entries(data as Record<string, unknown>).forEach(([owner, entries]) => {
        if (!Array.isArray(entries)) {
            throw new Error(`watched.json[${owner}]: expected an array of entries`);
        }
        entries.forEach((entry, index) => {
            const e = entry as Partial<WatchedEntry> | null;
            if (typeof e !== 'object' || e === null || typeof e.imdbID !== 'string') {
                throw new Error(`watched.json[${owner}]: entry ${index} missing or invalid "imdbID"`);
            }
            if (typeof e.watchDate !== 'string' || e.watchDate.length === 0) {
                throw new Error(
                    `watched.json[${owner}] (${e.imdbID}): missing or invalid "watchDate"`
                );
            }
        });
    });

    return data as WatchedLog;
}

export const watchedLog = assertWatchedData(watchedData);
