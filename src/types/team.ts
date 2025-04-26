import teamMembersData from '../assets/club.json';

export interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
  queue?: number;
  color?: string;
}

export const teamMembers: TeamMember[] = teamMembersData;

export const getTeamMemberByName = (name: string): TeamMember | undefined => {
  return teamMembers.find(member => member.name.toLowerCase() === name.toLowerCase());
};

export const getTeamMemberColorByName = (name: string): string | undefined => {
  const member = getTeamMemberByName(name);
  return member?.color;
};