import { useCallback, useMemo } from 'react';

import type { RatingOverride } from '../api/clubApi';
import { useOverrides } from '../contexts/OverridesContext';

/**
 * The member-authored rating edits recorded for one film.
 *
 * A slice of {@link useOverrides}, which holds the whole of `overrides.json`
 * and fetches it once per session. This hook used to do the fetching itself,
 * once per film-detail page view, for a file that is the same on every page.
 *
 * The interface is unchanged from that version, so callers still get an empty
 * map when signed out and can render it unconditionally.
 */
export interface FilmOverridesState {
    /** Keyed by lowercased member name, as `overrides.json` stores them. */
    ratings: Record<string, RatingOverride>;
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch, and persists it so it
     * survives a reload while the CDN catches up. `null` removes the row.
     */
    applyLocal: (user: string, rating: RatingOverride | null) => void;
}

export function useFilmOverrides(imdbId: string | undefined): FilmOverridesState {
    const { films, loading, error, applyRating } = useOverrides();

    const ratings = useMemo(() => (imdbId ? (films[imdbId]?.ratings ?? {}) : {}), [films, imdbId]);

    const applyLocal = useCallback(
        (user: string, rating: RatingOverride | null) => {
            if (imdbId) applyRating(imdbId, user, rating);
        },
        [applyRating, imdbId]
    );

    return { ratings, loading, error, applyLocal };
}
