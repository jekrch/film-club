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
    /**
     * An `https` image the member picked for this row's background art, or null
     * to use whatever the film already has. Absent on entries written before the
     * field existed, which is why readers treat it as optional.
     */
    image?: string | null;
    /**
     * An `https` image the member picked as this film's poster, or null to use
     * the one OMDB supplied. Absent on entries written before the field
     * existed, for the same reason {@link image} may be.
     *
     * Separate from {@link image}: this stands in for the poster wherever the
     * row draws one, at poster proportions, while `image` is wide art washed
     * behind the row. See the note on the list-entry field of the same name.
     */
    posterImage?: string | null;
    /**
     * A YouTube video key the member picked as this film's trailer, or null to
     * play whatever trailer the film itself has. Absent on entries written
     * before the field existed, like the two image fields above. See the note on
     * the list-entry field of the same name for why a key is stored rather than
     * the URL they pasted.
     */
    trailerKey?: string | null;
    /**
     * True when the member wants this row to offer no trailer at all. Separate
     * from {@link trailerKey}, and wins over it — same reasoning as the
     * list-entry field of the same name.
     */
    hideTrailer?: boolean;
    updatedAt: string;
}

/**
 * Several members' logs at once: display name → their entries, newest watch
 * first. Whatever a page fetched, so it holds only the members that page asked
 * for (see `useWatchedLog`).
 */
export type WatchedLog = Record<string, WatchedEntry[]>;

/**
 * The file name a member's log is stored and published under: `Jacob` →
 * `jacob`, so `src/assets/watched/jacob.json` in the repo and
 * `data/watched/jacob.json` on the site.
 *
 * **Not bundled.** Each log is fetched by the pages that show it. A logged film
 * used to add its entry to every visitor's first page load; now it costs only
 * the reader of that log. The worker writes one file per member, and
 * a watch-log commit publishes just these files without rebuilding the site
 * (`.github/workflows/data-deploy.yml`).
 *
 * The same rule as the worker's `slugify` and `memberSlug` in
 * `scripts/liveData.ts`; `watched.test.ts` checks all three agree.
 */
export const memberSlug = (name: string): string =>
    name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/**
 * Checks one fetched log file and returns it typed.
 *
 * Intentionally shallow, like the bundled files' asserts: it checks the fields
 * the page routes and sorts on, not the full schema (the worker validates on
 * write). A malformed file throws here, where the fetch's caller reports it,
 * rather than as an opaque crash deep in a render.
 */
export function assertWatchedEntries(data: unknown, file: string): WatchedEntry[] {
    if (!Array.isArray(data)) {
        throw new Error(`${file}: expected an array of entries`);
    }
    data.forEach((entry, index) => {
        const e = entry as Partial<WatchedEntry> | null;
        if (typeof e !== 'object' || e === null || typeof e.imdbID !== 'string') {
            throw new Error(`${file}: entry ${index} missing or invalid "imdbID"`);
        }
        if (typeof e.watchDate !== 'string' || e.watchDate.length === 0) {
            throw new Error(`${file} (${e.imdbID}): missing or invalid "watchDate"`);
        }
    });
    return data as WatchedEntry[];
}
