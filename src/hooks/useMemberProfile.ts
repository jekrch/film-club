import { useCallback, useEffect, useState } from 'react';

import { fetchClub } from '../api/repoData';
import { recordWrite, writeKeys } from '../api/writeCache';
import { useClubAuth } from '../auth/GoogleAuth';
import type { TeamMember } from '../types/team';

/**
 * One member's `club.json` record, read live from the repo.
 *
 * The bundle already has every profile; this exists so a member sees their own
 * recent save rather than the copy from the last build.
 *
 * It fetches only for someone who can edit this profile. For everyone else it
 * settles at `null`, so callers can fall back to the bundle unconditionally.
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
