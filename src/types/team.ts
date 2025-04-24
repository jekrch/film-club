import teamMembersData from '../assets/club.json';

export interface TeamMember {
  name: string;
  title: string;
  bio: string;
  image: string;
  queue?: number;
}

export const teamMembers: TeamMember[] = teamMembersData;