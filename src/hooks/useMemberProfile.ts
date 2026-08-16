import { useCallback, useEffect, useState } from 'react';

import { fetchClub } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { useClubAuth } from '../auth/GoogleAuth';
import type { TeamMember } from '../types/team';

/**
 * One member's `club.json` record, read live from the repo.
 *
 * The bundle already carries every profile, so this exists for one reason: a
 * member who saved a minute ago must see their own words rather than the copy
 * baked in at the last build (§8.8). A save commits to the repo and is live
 * after the next Pages build; without this the editor would reopen showing the
 * bio they just replaced, which reads exactly like a save that failed.
 *
 * It fetches only for someone who could actually edit this profile. That is a
 * product choice rather than a constraint now that the read needs no token: a
 * visitor reading a profile has no use for a value the page is about to render
 * from the bundle anyway. For everyone else it settles at `null`, so callers
 * can fall back unconditionally.
 */
export interface MemberProfileState {
    /** The live record, or null when it hasn't been read (or couldn't be). */
    profile: TeamMember | null;
    loading: boolean;
    error: string | null;
    /**
     * Records the result of a write without a refetch. The worker returns the
     * stored record, so re-reading right after a save would cost a round trip
     * to learn what the response already said. It also persists the result
     * through `writeCache`, so the value survives a reload while GitHub's CDN
     * is still serving the copy from before the save.
     */
    applyLocal: (member: TeamMember) => void;
}

export function useMemberProfile(name: string | undefined): MemberProfileState {
    const { status, canEditAs } = useClubAuth();
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

        fetchClub(controller.signal)
            .then((club) => {
                if (controller.signal.aborted) return;
                const match = club.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
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
    }, [status, name, editable]);

    const applyLocal = useCallback((member: TeamMember) => {
        recordWrite('profile', writeKeys.profile(member.name), member);
        setProfile(member);
    }, []);

    return { profile, loading, error, applyLocal };
}
