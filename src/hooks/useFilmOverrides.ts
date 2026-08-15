import { useCallback, useEffect, useState } from 'react';

import { getOverrides, type RatingOverride } from '../api/clubApi';
import { useClubAuth } from '../auth/GoogleAuth';

/**
 * The member-authored rating edits recorded for one film, read live from `main`.
 *
 * Two things need this. The editor needs it so a member who saved a minute ago
 * sees their own value rather than the one baked into the bundle at the last
 * build (§8.8), and the ratings list needs it to mark rows the sheet no longer
 * controls (§8.7).
 *
 * It fetches only while signed in — the endpoint is authenticated, and the
 * markers are for members editing, not for visitors. Signed out it settles at
 * an empty map, so callers can render it unconditionally.
 */
export interface FilmOverridesState {
    /** Keyed by lowercased member name, as `overrides.json` stores them. */
    ratings: Record<string, RatingOverride>;
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch. The worker returns the
     * stored record, so re-reading `main` right after a save would cost a round
     * trip to learn what the response already said. `null` removes the row.
     */
    applyLocal: (user: string, rating: RatingOverride | null) => void;
}

export function useFilmOverrides(imdbId: string | undefined): FilmOverridesState {
    const { status, withToken } = useClubAuth();
    const [ratings, setRatings] = useState<Record<string, RatingOverride>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status !== 'signed-in' || !imdbId) {
            setRatings({});
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        withToken((token) => getOverrides(token, controller.signal))
            .then((overrides) => {
                if (controller.signal.aborted) return;
                setRatings(overrides.films?.[imdbId]?.ratings ?? {});
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                // A failed read costs the markers and the live values, not the
                // ability to save — so it reports itself and leaves the editor
                // working off the bundled data.
                setError(err instanceof Error ? err.message : "Couldn't load your saved edits.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [status, imdbId, withToken]);

    const applyLocal = useCallback((user: string, rating: RatingOverride | null) => {
        setRatings((current) => {
            const next = { ...current };
            if (rating) next[user.toLowerCase()] = rating;
            else delete next[user.toLowerCase()];
            return next;
        });
    }, []);

    return { ratings, loading, error, applyLocal };
}
