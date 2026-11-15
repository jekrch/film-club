import React from 'react';
import { Link } from 'react-router-dom';
import type { TeamMember } from '../../../types/team';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { formatScore, memberColor, retrospectivePath } from './format';

interface MemberClosingProps {
    year: number;
    member: TeamMember;
    closing: MemberRetrospective['closing'];
    /** The other members with a report this year. */
    others: TeamMember[];
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/**
 * The year in four figures, laid out to be screenshotted, with the way on to
 * the club's report and everyone else's. All four exist for a member with no
 * watch log: films, average given, favourite, trophies.
 */
const MemberClosing: React.FC<MemberClosingProps> = ({
    year,
    member,
    closing,
    others,
    accent,
    reel,
}) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>The Criterion Club · {year}</Eyebrow>
            <h2 className="mt-3 font-serif text-4xl text-slate-50 sm:text-6xl">
                {member.name}'s year
            </h2>
        </Reveal>
        <Reveal step={1}>
            <dl
                className="grid grid-cols-2 gap-x-6 rounded-lg border border-slate-100/10 bg-slate-950/40 p-5 sm:p-8"
                style={{ marginTop: give('2rem', '1rem'), rowGap: give('1.5rem', '0.75rem') }}
            >
                <div>
                    <dt className="text-sm text-slate-400">Films</dt>
                    <dd className="font-serif text-4xl text-slate-50 sm:text-5xl">
                        {closing.films}
                    </dd>
                </div>
                <div>
                    <dt className="text-sm text-slate-400">Average score</dt>
                    <dd className="font-serif text-4xl text-slate-50 sm:text-5xl">
                        {closing.averageGiven === null ? '—' : closing.averageGiven.toFixed(1)}
                    </dd>
                </div>
                <div>
                    <dt className="text-sm text-slate-400">Favourite</dt>
                    <dd className="mt-1 flex items-center gap-3">
                        {closing.favourite ? (
                            <>
                                <Poster
                                    src={closing.favourite.film.poster}
                                    title={closing.favourite.film.title}
                                    className="w-10"
                                />
                                <span className="font-serif leading-snug text-slate-100">
                                    {closing.favourite.film.title}{' '}
                                    <span className="text-slate-400">
                                        ({formatScore(closing.favourite.score)})
                                    </span>
                                </span>
                            </>
                        ) : (
                            <span className="font-serif text-4xl text-slate-50">—</span>
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="text-sm text-slate-400">Trophies</dt>
                    <dd className="font-serif text-4xl text-slate-50 sm:text-5xl">
                        {closing.trophies}
                    </dd>
                </div>
            </dl>
        </Reveal>
        <Reveal step={2}>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Link
                    to={retrospectivePath(year)}
                    className="font-medium text-slate-200 underline-offset-4 hover:underline"
                >
                    The club's year
                </Link>
                {others.map((other, i) => (
                    <Link
                        key={other.name}
                        to={retrospectivePath(year, other.name)}
                        className="font-medium underline-offset-4 hover:underline"
                        style={{ color: memberColor(other, i) }}
                    >
                        {other.name}
                    </Link>
                ))}
            </div>
        </Reveal>
    </Slide>
);

export default MemberClosing;
