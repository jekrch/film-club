import { useCallback, useMemo } from 'react';

import { useTrophies } from '../contexts/TrophiesContext';
import type { Trophy } from '../types/trophy';

/**
 * The awards recorded on one film.
 *
 * A slice of {@link useTrophies}, which holds the whole of `trophies.json` and
 * reads it once per session — the same arrangement `useFilmOverrides` has with
 * the overrides file, and for the same reason: it is one file for the whole
 * site, so it is one read for the whole site.
 *
 * Unlike the overrides slice this is never empty just because nobody is signed
 * in. The context falls back to the bundled file, so a visitor gets the awards
 * as of the last build and a member gets them as of `main`.
 */
export interface FilmTrophiesState {
    /** Oldest award first, as the worker stores them. */
    trophies: Trophy[];
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch, and persists it so it
     * survives a reload while the CDN catches up. `null` withdraws the award.
     */
    applyLocal: (id: string, trophy: Trophy | null) => void;
}

export function useFilmTrophies(imdbId: string | undefined): FilmTrophiesState {
    const { films, loading, error, applyTrophy } = useTrophies();

    const trophies = useMemo(() => (imdbId ? (films[imdbId] ?? []) : []), [films, imdbId]);

    const applyLocal = useCallback(
        (id: string, trophy: Trophy | null) => {
            if (imdbId) applyTrophy(imdbId, id, trophy);
        },
        [applyTrophy, imdbId]
    );

    return { trophies, loading, error, applyLocal };
}
