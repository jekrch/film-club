import React from 'react';
import type { Film } from '../../../types/film';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { FilmStrip, Poster } from './shared';
import { numberWord } from './format';

interface MemberPicksProps {
    picks: Film[];
    stillsOf: (film: Film) => string[];
    accent: string;
}

/** The films they brought to the club, each with a strip of its frames. No scores. */
const MemberPicks: React.FC<MemberPicksProps> = ({ picks, stillsOf, accent }) => (
    <Slide>
        <Reveal>
            <Eyebrow color={accent}>Your picks</Eyebrow>
            <h2 className="mt-3 font-serif text-3xl text-slate-50 sm:text-5xl">
                You brought us {numberWord(picks.length)} film{picks.length === 1 ? '' : 's'}
            </h2>
        </Reveal>
        <div className="mt-6 flex flex-col" style={{ gap: give('1.25rem', '0.625rem') }}>
            {picks.slice(0, 3).map((film, i) => (
                <Reveal key={film.imdbID} step={1 + i * 0.6}>
                    <div className="flex items-center gap-4">
                        <Poster
                            src={film.poster}
                            title={film.title}
                            to={`/films/${film.imdbID}`}
                            className="w-14 sm:w-20"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="font-serif text-xl text-slate-100 sm:text-2xl">
                                {film.title}{' '}
                                <span className="text-base text-slate-500">
                                    {film.year.slice(0, 4)}
                                </span>
                            </p>
                            <FilmStrip stills={stillsOf(film)} className="mt-2 max-w-sm" />
                        </div>
                    </div>
                </Reveal>
            ))}
            {picks.length > 3 && (
                <Reveal step={3}>
                    <p className="text-slate-400">
                        …and {picks.length - 3} more:{' '}
                        {picks
                            .slice(3)
                            .map((f) => f.title)
                            .join(', ')}
                        .
                    </p>
                </Reveal>
            )}
        </div>
    </Slide>
);

export default MemberPicks;
