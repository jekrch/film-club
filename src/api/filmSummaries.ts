/**
 * The parts of the list-film cache that aren't in the bundle.
 *
 * The bundle carries `listFilms.json` as a slim index: title, poster, a few
 * stills, the fields a collapsed row draws (see `slimListFilms` in
 * `vite.config.ts`). Two things are fetched instead:
 *
 * - **One film's full summary** (`data/films/<id>.json`): plot, cast, crew,
 *   ratings, every still. Only a row's details panel shows these, so they load
 *   when someone opens or reaches for one ({@link fetchFilmSummary}).
 * - **The live index** (`data/films/index.json`): the same slim index, as the
 *   latest deploy published it. A watch-log commit is published without a
 *   build (`data-deploy.yml`), so a film logged since the last full build is in
 *   this copy and not in the bundle. {@link ensureFilmSummaries} fetches it
 *   only when a page meets such a film.
 *
 * Both are memoized for the life of the page. Neither changes often, and a
 * page that has to show something newer than its own load will get it on the
 * next one.
 */

import { DATA_BASE } from '../config/editorEnv';
import { filmData } from '../types/film';
import { listFilmSummaries, type ListFilmSummary } from '../types/list';
import { pendingFilmSummary } from '../utils/pendingFilmSummaries';

/** Full summaries this page has fetched, by id. */
const full = new Map<string, ListFilmSummary>();
/** In-flight or settled fetches, so two rows asking at once make one request. */
const requests = new Map<string, Promise<ListFilmSummary | null>>();

/** Index records from the live copy that the bundle lacks. */
const live = new Map<string, ListFilmSummary>();
let liveIndex: Promise<void> | null = null;

async function fetchJson(path: string): Promise<unknown> {
    const response = await fetch(`${DATA_BASE}/${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
}

const isSummary = (value: unknown): value is ListFilmSummary =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ListFilmSummary).title === 'string' &&
    (value as ListFilmSummary).title.length > 0;

/**
 * One film's whole summary, or null when there is none to fetch (a club film,
 * a film CI hasn't reached yet) or the fetch failed.
 *
 * A failure isn't remembered, so the next open tries again; a missing file is,
 * since asking again in the same page load won't make it appear.
 */
export function fetchFilmSummary(imdbID: string): Promise<ListFilmSummary | null> {
    const pending = requests.get(imdbID);
    if (pending) return pending;

    const request = fetchJson(`films/${encodeURIComponent(imdbID)}.json`)
        .then((data) => {
            if (!isSummary(data)) return null;
            full.set(imdbID, data);
            return data;
        })
        .catch((error: unknown) => {
            if (!(error instanceof Error && / 404$/.test(error.message))) {
                requests.delete(imdbID);
            }
            return null;
        });

    requests.set(imdbID, request);
    return request;
}

/** The full summary if this page has already fetched it. */
export const loadedFilmSummary = (imdbID: string): ListFilmSummary | undefined => full.get(imdbID);

/**
 * Makes sure the summary lookup below can answer for every id given, fetching
 * the live index if any of them is unknown to the bundle.
 *
 * Resolves either way: a page that can't get the index still renders, with a
 * placeholder title on the rows it couldn't name.
 */
export function ensureFilmSummaries(ids: Iterable<string>): Promise<void> {
    if (liveIndex) return liveIndex;

    let unknown = false;
    for (const id of ids) {
        if (!knownToBundle(id)) {
            unknown = true;
            break;
        }
    }
    if (!unknown) return Promise.resolve();

    liveIndex = fetchJson('films/index.json')
        .then((data) => {
            if (typeof data !== 'object' || data === null) return;
            for (const [id, summary] of Object.entries(data as Record<string, unknown>)) {
                if (!(id in listFilmSummaries) && isSummary(summary)) live.set(id, summary);
            }
        })
        .catch(() => {
            // Leave the rows to their placeholders, and let a later page try.
            liveIndex = null;
        });
    return liveIndex;
}

let bundledFilmIds: Set<string> | null = null;

const knownToBundle = (imdbID: string): boolean => {
    bundledFilmIds ??= new Set(filmData.map((film) => film.imdbID));
    return imdbID in listFilmSummaries || bundledFilmIds.has(imdbID);
};

/**
 * The summary record for a film that isn't a club film, from wherever this page
 * knows it: the bundled index (or a test's fixture in its place), then the live
 * index, then whatever the search hit that added it knew.
 *
 * The resolvers' one lookup, so the order is decided once.
 */
export const findFilmSummary = (
    imdbID: string,
    summaries: Record<string, ListFilmSummary> = listFilmSummaries
): ListFilmSummary | undefined =>
    summaries[imdbID] ?? live.get(imdbID) ?? pendingFilmSummary(imdbID);

/** Forgets everything fetched. For tests. */
export const resetFilmSummaries = (): void => {
    full.clear();
    requests.clear();
    live.clear();
    liveIndex = null;
    bundledFilmIds = null;
};
