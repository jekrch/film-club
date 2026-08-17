import teamMembersData from '../assets/club.json';
import { ComprehensiveMemberStats, MemberStatHighlight } from '../utils/statUtils';

/**
 * Where a member's profile banner gets its art. Mirrors `BackdropMode` in
 * `worker/src/types.ts`; `top-rated` is the default and is stored as an absent
 * field rather than the string.
 *
 * `top-rated` is the collage this site has always drawn — the club films that
 * member scored highest, recut on every load. `selected` is a few films they
 * named themselves, which need not be club films: the banner resolves art
 * through the same summary cache their lists and watch log use.
 */
export type BackdropMode = 'top-rated' | 'selected';

export interface TeamMember {
    name: string;
    title: string;
    bio: string;
    url?: string;
    image: string;
    queue?: number;
    color?: string;
    interview?: InterviewItem[];
    /** Absent means `top-rated`, which is what every profile was before this existed. */
    backdropMode?: BackdropMode;
    /** IMDb ids, in the order the member chose them. Only read in `selected` mode. */
    backdropFilms?: string[];
}

export interface InterviewItem {
    /** The interview question. */
    question: string;
    /** The interview answer (can contain Markdown). */
    answer: string;
}

export const teamMembers: TeamMember[] = teamMembersData;

export const getTeamMemberByName = (name: string): TeamMember | undefined => {
    return teamMembers.find((member) => member.name.toLowerCase() === name.toLowerCase());
};

export const getTeamMemberColorByName = (name: string): string | undefined => {
    const member = getTeamMemberByName(name);
    return member?.color;
};

export const capitalizeUserName = (val: string) => {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};

export interface MemberStatsData {
    member: TeamMember;
    stats: ComprehensiveMemberStats; // Use the comprehensive type
    highlights: {
        // Keep the highlight structure, keys match ComprehensiveMemberStats
        avgRuntime: MemberStatHighlight; // Renamed from avgSelectionRuntime
        avgSelectedScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight; // Kept specific name for clarity if needed
        avgSelectionYear: MemberStatHighlight;
    };
}
