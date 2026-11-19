import React from 'react';
import type { Film } from '../../../types/film';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { formatScore } from './format';
import { FilmStrip, Poster } from './shared';

interface MemberPicksProps {
    picks: Film[];
    bestPick: MemberRetrospective['bestPick'];
    stillsOf: (film: Film) => string[];
    accent: string;
}

/**
 * The films they brought to the club, each with a strip of its frames. No
 * scores, save the one line under a pick that drew the highest average of any
 * they've made in all their years.
 */
const MemberPicks: React.FC<MemberPicksProps> = ({ picks, bestPick, stillsOf, accent }) => {
    const best = new Set(bestPick?.films.map((f) => f.imdbID));

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Your picks</Eyebrow>
            </Reveal>
            <div className="mt-6 flex flex-col" style={{ gap: give('1.25rem', '0.625rem') }}>
                {picks.map((film, i) => (
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
                                {bestPick && best.has(film.imdbID) && (
                                    <p
                                        className="mt-1 text-xs uppercase tracking-widest sm:text-sm"
                                        style={{ color: accent }}
                                    >
                                        {bestPick.tied ? 'Tied for the highest' : 'The highest'}{' '}
                                        average of all your picks · {formatScore(bestPick.average)}
                                    </p>
                                )}
                                <FilmStrip stills={stillsOf(film)} className="mt-2 max-w-sm" />
                            </div>
                        </div>
                    </Reveal>
                ))}
            </div>
        </Slide>
    );
};

export default MemberPicks;
