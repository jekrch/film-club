import React from 'react';
import { Link } from 'react-router-dom';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Headshot, Poster } from './shared';
import { formatCredit, headshotFor, numberWord } from './format';

interface ClubFacesProps {
    faces: NonNullable<ClubRetrospective['faces']>;
    reel: string[];
    accent: string;
}

/**
 * Repeat artists: the people credited on more than one of the year's films,
 * and what they did on each — the same name as director on one and writer on
 * another is the interesting part, and for actors, who they played.
 */
const ClubFaces: React.FC<ClubFacesProps> = ({ faces, reel, accent }) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>Repeat artists</Eyebrow>
        </Reveal>
        <div className="mt-5 flex flex-col" style={{ gap: give('1.5rem', '0.75rem') }}>
            {faces.map((face, i) => {
                const films = face.credits.map((c) => c.film);
                return (
                    <Reveal key={face.name} step={1 + i * 0.8}>
                        <div className="flex items-start gap-4 sm:gap-6">
                            <Headshot
                                src={headshotFor(face.name, films)}
                                name={face.name}
                                accent={accent}
                                size={
                                    i === 0
                                        ? 'h-20 w-20 sm:h-24 sm:w-24'
                                        : 'h-14 w-14 sm:h-16 sm:w-16'
                                }
                            />
                            <div className="min-w-0 flex-1">
                                <h2
                                    className={`font-serif leading-tight text-slate-50 ${
                                        i === 0 ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'
                                    }`}
                                >
                                    {face.name}
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    on {numberWord(face.credits.length)} of our films
                                </p>
                                <ul className="mt-3 flex flex-wrap gap-3">
                                    {face.credits.map(({ film, roles, character }) => (
                                        <li key={film.imdbID} className="flex items-center gap-2">
                                            <Poster
                                                src={film.poster}
                                                title={film.title}
                                                to={`/films/${film.imdbID}`}
                                                className="w-8 sm:w-10"
                                            />
                                            <span className="text-sm leading-snug">
                                                <Link
                                                    to={`/films/${film.imdbID}`}
                                                    className="font-serif text-slate-100 hover:underline"
                                                >
                                                    {film.title}
                                                </Link>
                                                <br />
                                                <span className="text-slate-400">
                                                    {formatCredit({ roles, character })}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    </Slide>
);

export default ClubFaces;
