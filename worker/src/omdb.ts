/**
 * OMDB search proxy for the editor's add-film picker.
 *
 * This endpoint exists only so `OMDB_API_KEY` stays a worker secret instead of
 * shipping in the site bundle. It is search and nothing else: the *metadata*
 * for a list film is fetched in CI by `enrich_list_films.py`, so a save makes no
 * OMDB call at all no matter how long the list is (§8.6). What comes back here
 * is just enough to render a picker row and record an id.
 */

import { HttpError } from './errors';
import type { Env, FilmSearchResult } from './types';

const OMDB_URL = 'https://www.omdbapi.com/';

interface OmdbSearchResponse {
    Response: string;
    Error?: string;
    Search?: Array<{ imdbID?: string; Title?: string; Year?: string; Poster?: string }>;
}

/** OMDB writes the string "N/A" where it has no value; the site expects null. */
function clean(value: string | undefined): string | null {
    const text = (value ?? '').trim();
    return text === '' || text === 'N/A' ? null : text;
}

/**
 * Searches OMDB by title. Returns at most one page (OMDB's own limit is ten per
 * page), which is plenty for a picker the member types into.
 */
export async function searchFilms(env: Env, query: string): Promise<FilmSearchResult[]> {
    const url = new URL(OMDB_URL);
    url.searchParams.set('apikey', env.OMDB_API_KEY);
    url.searchParams.set('s', query);
    url.searchParams.set('type', 'movie');

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new HttpError(502, `Film search failed (${resp.status}).`);

    const data = (await resp.json()) as OmdbSearchResponse;
    // "Movie not found!" is a normal empty result, not a failure worth a 502.
    if (data.Response !== 'True') return [];

    return (data.Search ?? [])
        .filter((hit): hit is { imdbID: string } & typeof hit => typeof hit.imdbID === 'string')
        .map((hit) => ({
            imdbID: hit.imdbID,
            title: clean(hit.Title) ?? hit.imdbID,
            year: clean(hit.Year),
            poster: clean(hit.Poster),
        }));
}
