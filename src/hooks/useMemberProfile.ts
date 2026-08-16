import { useCallback, useEffect, useState } from 'react';

import { getClub } from '../api/clubApi';
import { useClubAuth } from '../auth/GoogleAuth';
import type { TeamMember } from '../types/team';

/**
 * One member's `club.json` record, read live from `main`.
 *
 * The bundle already carries every profile, so this exists for one reason: a
 * member who saved a minute ago must see their own words rather than the copy
 * baked in at the last build (§8.8). A save commits to the repo and is live
 * after the next Pages build; without this the editor would reopen showing the
 * bio they just replaced, which reads exactly like a save that failed.
 *
 * It fetches only for someone who could actually edit this profile — the
 * endpoint is authenticated, and a visitor reading a profile has no use for a
 * value the page is about to render from the bundle anyway. For everyone else
 * it settles at `null`, so callers can fall back unconditionally.
 */
export interface MemberProfileState {
    /** The live record, or null when it hasn't been read (or couldn't be). */
    profile: TeamMember | null;
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch. The worker returns the
     * stored record, so re-reading `main` right after a save would cost a round
     * trip to learn what the response already said.
     */
    applyLocal: (member: TeamMember) => void;
}

export function useMemberProfile(name: string | undefined): MemberProfileState {
    const { status, canEditAs, withToken } = useClubAuth();
    const [profile, setProfile] = useState<TeamMember | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const editable = canEditAs(name);

    useEffect(() => {
        if (status !== 'signed-in' || !name || !editable) {
            setProfile(null);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        withToken((token) => getClub(token, controller.signal))
            .then((club) => {
                if (controller.signal.aborted) return;
                const match = club.find(
                    (entry) => entry.name.toLowerCase() === name.toLowerCase()
                );
                // A name the roster doesn't know is not an error to report: the
                // page is already rendering that member from the bundle, and the
                // only way here is a profile that exists.
                setProfile(match ?? null);
            })
            .catch((err: unknown) => {
                if (controller.signal.aborted) return;
                // A failed read costs the live values, not the ability to save —
                // so it says so and leaves the editor working off the bundle.
                setError(err instanceof Error ? err.message : "Couldn't load your saved profile.");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [status, name, editable, withToken]);

    const applyLocal = useCallback((member: TeamMember) => setProfile(member), []);

    return { profile, loading, error, applyLocal };
}
