import React from 'react';
import { Link } from 'react-router-dom';
import type { Film } from '../../../types/film';
import type { TeamMember } from '../../../types/team';
import CircularImage from '../../common/CircularImage';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { memberColor, numberWord, retrospectivePath } from './format';

interface ClubClosingProps {
    year: number;
    roster: TeamMember[];
    guests: { member: TeamMember; films: Film[] }[];
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/** "Greg, our intern, who sat in on The Odyssey" — a guest, in passing. */
const guestLine = ({ member, films }: { member: TeamMember; films: Film[] }): string => {
    const role = member.title ? `, our ${member.title.toLowerCase()},` : '';
    const sat = films.length === 1 ? films[0].title : `${numberWord(films.length)} screenings`;
    return `${member.name}${role} who sat in on ${sat}`;
};

/** See you next year, and a door into each member's own report. */
const ClubClosing: React.FC<ClubClosingProps> = ({ year, roster, guests, accent, reel }) => (
    <Slide reel={reel} className="text-center">
        <Reveal>
            <Eyebrow color={accent}>The Criterion Club</Eyebrow>
            <h2 className="mt-4 font-serif text-5xl text-slate-50 sm:text-7xl">
                See you in {year + 1}
            </h2>
        </Reveal>
        {roster.length > 0 && (
            <Reveal step={1}>
                <p className="mt-8 text-sm text-slate-400 sm:text-base">Each of our years</p>
                <div className="mt-4 flex flex-wrap justify-center gap-5 sm:gap-8">
                    {roster.map((member, i) => (
                        <Link
                            key={member.name}
                            to={retrospectivePath(year, member.name)}
                            className="group flex flex-col items-center gap-2"
                        >
                            <div
                                className="rounded-full p-0.5"
                                style={{ boxShadow: `0 0 0 2px ${memberColor(member, i)}` }}
                            >
                                <CircularImage alt={member.name} size="w-14 h-14 sm:w-16 sm:h-16" />
                            </div>
                            <span
                                className="text-sm font-medium"
                                style={{ color: memberColor(member, i) }}
                            >
                                {member.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </Reveal>
        )}
        {guests.length > 0 && (
            <Reveal step={2}>
                <p className="mt-8 font-serif text-sm italic text-slate-500 sm:text-base">
                    With thanks to {guests.map(guestLine).join(', and ')}.
                </p>
            </Reveal>
        )}
    </Slide>
);

export default ClubClosing;
