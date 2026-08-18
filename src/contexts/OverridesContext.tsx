import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import type { FilmRecordPatch, OverridesFile, RatingOverride } from '../api/clubApi';
import { fetchOverrides } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { useClubAuth } from '../auth/GoogleAuth';

/**
 * Every member-authored edit to a club film, fetched once per session.
 *
 * This used to be per-film: `useFilmOverrides` fetched the whole of
 * `overrides.json` on every film-detail page view and then used one film's
 * worth of it. Reading ten films re-read the same file ten times. It is one
 * file for the whole site, so it is now one fetch for the whole site, and
 * `useFilmOverrides` slices it.
 *
 * Two things want it. The editor needs it so a member who saved a minute ago
 * sees their own value rather than the one baked into the bundle at the last
 * build (§8.8), and the ratings list needs it to mark rows the sheet no longer
 * controls (§8.7).
 *
 * It fetches only while signed in. That is no longer forced on us — the file is
 * public and the read needs no token — but it stays deliberate: the markers are
 * for members editing, not for visitors, and a signed-out visitor should see
 * the site exactly as the last deploy left it. Signed out it settles at an
 * empty map, so callers can render it unconditionally.
 */
interface OverridesValue {
    films: OverridesFile['films'];
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch. The worker returns the
     * stored record, so re-reading right after a save would cost a round trip
     * to learn what the response already said. `null` removes the row.
     *
     * It also persists the result through `writeCache`, which is what makes the
     * value survive a reload while GitHub's CDN is still serving the copy from
     * before the save.
     */
    applyRating: (imdbId: string, member: string, rating: RatingOverride | null) => void;
    /**
     * The same, for a film's own club record — whose pick it was, when the club
     * watched it, and its two images. `null` removes it, which is what a revert
     * or a withdrawn submission does.
     */
    applyFilm: (imdbId: string, record: FilmRecordPatch | null) => void;
}

const OverridesContext = createContext<OverridesValue | undefined>(undefined);

export const OverridesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { status } = useClubAuth();
    const [films, setFilms] = useState<OverridesFile['films']>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status !== 'signed-in') {
            setFilms({});
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchOverrides(controller.signal)
            .then((overrides) => {
                if (controller.signal.aborted) return;
                setFilms(overrides.films ?? {});
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                // A failed read costs the markers and the live values, not the
                // ability to save — so it reports itself and leaves the editors
                // working off the bundled data.
                setError(err instanceof Error ? err.message : "Couldn't load your saved edits.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [status]);

    const applyRating = useCallback(
        (imdbId: string, member: string, rating: RatingOverride | null) => {
            recordWrite('rating', writeKeys.rating(imdbId, member), rating);

            setFilms((current) => {
                const ratings = { ...(current[imdbId]?.ratings ?? {}) };
                if (rating) ratings[member.toLowerCase()] = rating;
                else delete ratings[member.toLowerCase()];
                return { ...current, [imdbId]: { ...current[imdbId], ratings } };
            });
        },
        []
    );

    const applyFilm = useCallback((imdbId: string, record: FilmRecordPatch | null) => {
        recordWrite('film', writeKeys.film(imdbId), record);

        setFilms((current) => {
            // The ratings are untouched by a film write and must survive it —
            // an admin's scores and a member's cover edit are independent saves
            // against the same key.
            const ratings = current[imdbId]?.ratings ?? {};
            if (!record) {
                if (!current[imdbId]) return current;
                return { ...current, [imdbId]: { ratings } };
            }
            return { ...current, [imdbId]: { ...record, ratings } };
        });
    }, []);

    const value = useMemo<OverridesValue>(
        () => ({ films, loading, error, applyRating, applyFilm }),
        [films, loading, error, applyRating, applyFilm]
    );

    return <OverridesContext.Provider value={value}>{children}</OverridesContext.Provider>;
};

export const useOverrides = (): OverridesValue => {
    const context = useContext(OverridesContext);
    if (context === undefined) {
        throw new Error('useOverrides must be used within an OverridesProvider');
    }
    return context;
};
