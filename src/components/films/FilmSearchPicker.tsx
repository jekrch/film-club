import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';

import { useClubAuth } from '../../auth/GoogleAuth';
import { searchFilms, type FilmSearchResult } from '../../api/clubApi';

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

const FilmSearchPicker: React.FC<FilmSearchPickerProps> = ({
    onPick,
    chosen,
    label = 'Add a film',
    placeholder = 'Search by title…',
    chosenLabel = 'added',
    accent = 'amber',
}) => {
    const { status, withToken } = useClubAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FilmSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const trimmed = query.trim();
        if (status !== 'signed-in' || trimmed.length < MIN_QUERY) {
            setResults([]);
            setError(null);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setSearching(true);
            setError(null);
            withToken((token) => searchFilms(token, trimmed, controller.signal))
                .then((hits) => {
                    if (!controller.signal.aborted) setResults(hits);
                })
                .catch((err: unknown) => {
                    if (controller.signal.aborted) return;
                    setResults([]);
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

    if (status !== 'signed-in') return null;

    const styles = ACCENT[accent];

    return (
        <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-500">{label}</span>
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
                                onClick={() => onPick(hit)}
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
                                    {hit.year && <span className="ml-1.5 text-slate-500">{hit.year}</span>}
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
                </ul>
            )}
        </div>
    );
};

export default FilmSearchPicker;
