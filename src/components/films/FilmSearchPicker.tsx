import React, { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

import { useClubAuth } from '../../auth/GoogleAuth';
import { searchFilms, type FilmSearchResult } from '../../api/clubApi';
import { rememberFilmSummary } from '../../utils/pendingFilmSummaries';

/**
 * Title search over the worker's OMDB proxy, for the editors that add a film
 * the club never watched — the list editor and the watch log.
 *
 * The proxy is the reason this needs a session at all: the OMDB key stays
 * server-side, so searching is an authenticated call like every other worker
 * route. Signed out it renders nothing rather than an input whose every
 * keystroke would 401.
 *
 * Debounced at 350ms and aborted on change, so a fast typist costs one request
 * per pause rather than one per letter.
 *
 * OMDB answers ten hits at a time, so a common title can bury the film; "load
 * more" walks further pages. Past that, an IMDb id or IMDb link typed into the
 * box resolves to that one film — the worker recognises it.
 *
 * A pick also files the hit's title and poster with `pendingFilmSummaries`,
 * which is what keeps the row it becomes from reading "Unknown film" for the
 * minute or two before CI enriches the id.
 */

interface FilmSearchPickerProps {
    onPick: (hit: FilmSearchResult) => void;
    /** Ids already added, shown disabled so a double-tap can't add twice. */
    chosen: ReadonlySet<string>;
    label?: string;
    placeholder?: string;
    /** Word for an id already added — "added" on a list, "logged" in a watch log. */
    chosenLabel?: string;
    accent?: 'amber' | 'blue';
}

const ACCENT = {
    amber: { focus: 'focus:border-amber-400/60', icon: 'text-amber-400/80' },
    blue: { focus: 'focus:border-blue-400/60', icon: 'text-blue-400/80' },
} as const;

const MIN_QUERY = 2;
/** OMDB's page size, and the most pages it will serve. */
const PAGE_SIZE = 10;
const MAX_PAGES = 100;

/** Mirrors the worker's `parseImdbIdQuery`: only for choosing what hint to show. */
const looksLikeImdbId = (query: string) => /\btt\d{7,9}\b/i.test(query);

/** Later pages can repeat a hit from an earlier one; the list is keyed by id. */
function appendNew(shown: FilmSearchResult[], more: FilmSearchResult[]): FilmSearchResult[] {
    const seen = new Set(shown.map((hit) => hit.imdbID));
    return [...shown, ...more.filter((hit) => !seen.has(hit.imdbID))];
}

const FilmSearchPicker: React.FC<FilmSearchPickerProps> = ({
    onPick,
    chosen,
    label = 'Add a film',
    placeholder = 'Search by title or IMDb id…',
    chosenLabel = 'added',
    accent = 'amber',
}) => {
    const { status, withToken } = useClubAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FilmSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /**
     * The query `results` answer, which trails `query` through the debounce —
     * so "load more" asks for the next page of what's on screen, not of
     * whatever has been typed since.
     */
    const [searched, setSearched] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const moreRequest = useRef<AbortController | null>(null);

    useEffect(() => {
        // A new query makes any page still loading for the old one moot.
        moreRequest.current?.abort();
        setLoadingMore(false);

        const trimmed = query.trim();
        if (status !== 'signed-in' || trimmed.length < MIN_QUERY) {
            setResults([]);
            setSearched(null);
            setError(null);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setSearching(true);
            setError(null);
            withToken((token) => searchFilms(token, trimmed, 1, controller.signal))
                .then((found) => {
                    if (controller.signal.aborted) return;
                    setResults(found.results);
                    setTotal(found.total);
                    setPage(1);
                    setSearched(trimmed);
                })
                .catch((err: unknown) => {
                    if (controller.signal.aborted) return;
                    setResults([]);
                    setSearched(null);
                    setError(err instanceof Error ? err.message : 'Search failed.');
                })
                .finally(() => {
                    if (!controller.signal.aborted) setSearching(false);
                });
        }, 350);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [query, status, withToken]);

    useEffect(() => () => moreRequest.current?.abort(), []);

    const hasMore = searched !== null && !searching && page < MAX_PAGES && page * PAGE_SIZE < total;

    const loadMore = () => {
        if (searched === null) return;
        moreRequest.current?.abort();
        const controller = new AbortController();
        moreRequest.current = controller;
        const next = page + 1;

        setLoadingMore(true);
        setError(null);
        withToken((token) => searchFilms(token, searched, next, controller.signal))
            .then((found) => {
                if (controller.signal.aborted) return;
                setResults((shown) => appendNew(shown, found.results));
                // An empty page means OMDB's count overshot; stop offering more.
                setTotal(found.results.length > 0 ? found.total : 0);
                setPage(next);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                setError(err instanceof Error ? err.message : 'Search failed.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingMore(false);
            });
    };

    // The id route is the last resort, so it's offered only once paging can't
    // help: nothing found, or every page already shown.
    let hint: string | null = null;
    if (searched !== null && !searching && !loadingMore && !hasMore) {
        if (!looksLikeImdbId(searched)) {
            hint = `${results.length === 0 ? 'No matches.' : 'Not here?'} Paste the film's IMDb id (like tt0081505) or its IMDb link instead.`;
        } else if (results.length === 0) {
            hint = 'OMDb has no film with that id.';
        }
    }

    if (status !== 'signed-in') return null;

    const styles = ACCENT[accent];

    return (
        <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">
                {label}
            </span>
            <div className="relative">
                <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
                    className={`w-full rounded-md border border-slate-600/60 bg-slate-800/60 py-2 pl-9 pr-3 text-slate-100 placeholder:text-slate-500 focus:outline-none ${styles.focus}`}
                />
            </div>

            {searching && <p className="mt-2 text-sm italic text-slate-500">Searching…</p>}
            {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

            {results.length > 0 && (
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-700/60 p-1">
                    {results.map((hit) => (
                        <li key={hit.imdbID}>
                            <button
                                type="button"
                                onClick={() => {
                                    // Recorded here rather than in each caller:
                                    // this hit is the only place the film's
                                    // title and poster exist until CI enriches
                                    // it, and the row it becomes is drawn
                                    // immediately. Kept before `onPick` so the
                                    // render that handler causes already sees it.
                                    rememberFilmSummary(hit);
                                    onPick(hit);
                                }}
                                disabled={chosen.has(hit.imdbID)}
                                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-700/50 disabled:opacity-40"
                            >
                                {hit.poster ? (
                                    <img
                                        src={hit.poster}
                                        alt=""
                                        loading="lazy"
                                        className="h-12 w-8 flex-shrink-0 rounded object-cover object-top"
                                        onError={(e) => {
                                            e.currentTarget.style.visibility = 'hidden';
                                        }}
                                    />
                                ) : (
                                    <span className="h-12 w-8 flex-shrink-0 rounded bg-slate-800" />
                                )}
                                <span className="min-w-0 flex-grow truncate text-slate-200">
                                    {hit.title}
                                    {hit.year && (
                                        <span className="ml-1.5 text-slate-500">{hit.year}</span>
                                    )}
                                </span>
                                {chosen.has(hit.imdbID) ? (
                                    <span className="flex-shrink-0 text-xs uppercase tracking-wider text-slate-500">
                                        {chosenLabel}
                                    </span>
                                ) : (
                                    <PlusIcon
                                        className={`h-4 w-4 flex-shrink-0 ${styles.icon}`}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        </li>
                    ))}
                    {hasMore && (
                        <li>
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="w-full rounded-md px-2 py-2 text-center text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200 disabled:italic disabled:hover:bg-transparent"
                            >
                                {loadingMore
                                    ? 'Loading…'
                                    : `Load more — showing ${results.length} of ${total}`}
                            </button>
                        </li>
                    )}
                </ul>
            )}

            {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
        </div>
    );
};

export default FilmSearchPicker;
