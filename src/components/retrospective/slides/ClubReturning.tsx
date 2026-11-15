import React from 'react';
import { Link } from 'react-router-dom';
import type { ClubRetrospective, Credit } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Headshot, Poster } from './shared';
import { formatCredit, headshotFor } from './format';

interface ClubReturningProps {
    year: number;
    returning: NonNullable<ClubRetrospective['returning']>;
    reel: string[];
    accent: string;
}

const CreditLine: React.FC<{ credit: Credit; year?: number; faded?: boolean }> = ({
    credit,
    year,
    faded,
}) => (
    <li className="flex items-center gap-2">
        <Poster
            src={credit.film.poster}
            title={credit.film.title}
            to={`/films/${credit.film.imdbID}`}
            className={`w-8 sm:w-10 ${faded ? 'opacity-70' : ''}`}
        />
        <span className="text-sm leading-snug">
            <Link
                to={`/films/${credit.film.imdbID}`}
                className={`font-serif hover:underline ${faded ? 'text-slate-300' : 'text-slate-100'}`}
            >
                {credit.film.title}
            </Link>
            {year && <span className="text-slate-500"> · {year}</span>}
            <br />
            <span className="text-slate-400">{formatCredit(credit)}</span>
        </span>
    </li>
);

/**
 * Old acquaintances: people on this year's films whom the club had met on an
 * earlier year's, with what they did then and what they did now.
 */
const ClubReturning: React.FC<ClubReturningProps> = ({ year, returning, reel, accent }) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>Credits we'd seen before</Eyebrow>
        </Reveal>
        <div className="mt-5 flex flex-col" style={{ gap: give('1.75rem', '0.875rem') }}>
            {returning.map((person, i) => {
                const films = [...person.now, ...person.before].map((c) => c.film);
                return (
                    <Reveal key={person.name} step={1 + i * 0.8}>
                        <div className="flex items-start gap-4 sm:gap-6">
                            <Headshot
                                src={headshotFor(person.name, films)}
                                name={person.name}
                                accent={accent}
                                size="h-14 w-14 sm:h-20 sm:w-20"
                            />
                            <div className="min-w-0 flex-1">
                                <h2 className="font-serif text-2xl leading-tight text-slate-50 sm:text-4xl">
                                    {person.name}
                                </h2>
                                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            In {year}
                                        </p>
                                        <ul className="space-y-2">
                                            {person.now.map((credit) => (
                                                <CreditLine
                                                    key={credit.film.imdbID}
                                                    credit={credit}
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                            Before
                                        </p>
                                        <ul className="space-y-2">
                                            {person.before.slice(0, 3).map((credit) => (
                                                <CreditLine
                                                    key={credit.film.imdbID}
                                                    credit={credit}
                                                    year={credit.year}
                                                    faded
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubReturning;
