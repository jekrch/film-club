import React, {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { fetchTrophies } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { useClubAuth } from '../auth/GoogleAuth';
import { trophyIndex, type Trophy } from '../types/trophy';
import { compareTrophies } from '../utils/trophyUtils';

/**
 * Every award the club has given, as fresh as this session can see them.
 *
 * Same job as `OverridesContext`, with one difference that shows up in the
 * initial value. A rating override is invisible to a signed-out visitor — it has
 * already been folded into `films.json` by the time they load the page, and the
 * live file only marks which rows the sheet no longer owns. A trophy is the
 * thing itself, so the fallback here is the *bundled* file rather than an empty
 * map: signed out, this context serves what the last build baked in, which is
 * exactly what the galleries would have read on their own.
 *
 * Signed in, it fetches `trophies.json` from `main` once, because a member who
 * has just handed out an award should see it on the film page and on the
 * recipient's shelf immediately, not after the deploy a minute later (§8.8).
 */
interface TrophiesValue {
    /** IMDb id → that film's awards. Bundled until the live read lands. */
    films: Record<string, Trophy[]>;
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch. The worker returns the
     * stored award, so re-reading right after a save would cost a round trip to
     * learn what the response already said. `null` removes the row.
     *
     * It also persists the result through `writeCache`, which is what makes the
     * award survive a reload while GitHub's CDN is still serving the copy from
     * before the save.
     */
    applyTrophy: (imdbId: string, id: string, trophy: Trophy | null) => void;
}

const TrophiesContext = createContext<TrophiesValue | undefined>(undefined);

export const TrophiesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { status } = useClubAuth();
    const [films, setFilms] = useState<Record<string, Trophy[]>>(trophyIndex.films);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status !== 'signed-in') {
            // Back to the bundle, not to nothing: these awards are page content.
            setFilms(trophyIndex.films);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetchTrophies(controller.signal)
            .then((live) => {
                if (controller.signal.aborted) return;
                setFilms(live);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                // A failed read costs freshness, not the ability to award: the
                // bundled trophies stay on screen and saves still work.
                setError(err instanceof Error ? err.message : "Couldn't load the latest trophies.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [status]);

    const applyTrophy = useCallback((imdbId: string, id: string, trophy: Trophy | null) => {
        recordWrite('trophy', writeKeys.trophy(imdbId, id), trophy);

        setFilms((current) => {
            const without = (current[imdbId] ?? []).filter((existing) => existing.id !== id);
            const next = trophy ? [...without, trophy].sort(compareTrophies) : without;

            const films = { ...current };
            if (next.length === 0) delete films[imdbId];
            else films[imdbId] = next;
            return films;
        });
    }, []);

    const value = useMemo<TrophiesValue>(
        () => ({ films, loading, error, applyTrophy }),
        [films, loading, error, applyTrophy]
    );

    return <TrophiesContext.Provider value={value}>{children}</TrophiesContext.Provider>;
};

export const useTrophies = (): TrophiesValue => {
    const context = useContext(TrophiesContext);
    if (context === undefined) {
        throw new Error('useTrophies must be used within a TrophiesProvider');
    }
    return context;
};
