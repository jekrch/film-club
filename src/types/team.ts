import teamMembersData from '../assets/club.json';
import { ComprehensiveMemberStats, MemberStatHighlight } from '../utils/statUtils';

export interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
  queue?: number;
  color?: string;
  interview?: InterviewItem[];
}

export interface InterviewItem {
  /** The interview question. */
  question: string;
  /** The interview answer (can contain Markdown). */
  answer: string;
}


export const teamMembers: TeamMember[] = teamMembersData;

export const getTeamMemberByName = (name: string): TeamMember | undefined => {
  return teamMembers.find(member => member.name.toLowerCase() === name.toLowerCase());
};

export const getTeamMemberColorByName = (name: string): string | undefined => {
  const member = getTeamMemberByName(name);
  return member?.color;
};

export const capitalizeUserName = (val: string) => {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export interface MemberStatsData {
    member: TeamMember;
    stats: ComprehensiveMemberStats; // Use the comprehensive type
    highlights: { // Keep the highlight structure, keys match ComprehensiveMemberStats
        avgRuntime: MemberStatHighlight; // Renamed from avgSelectionRuntime
        avgSelectedScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight; // Kept specific name for clarity if needed
        avgSelectionYear: MemberStatHighlight;
    };
}