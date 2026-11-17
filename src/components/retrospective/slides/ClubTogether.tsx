import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Film } from '../../../types/film';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { Poster } from './shared';
import { formatScore } from './format';

interface ClubTogetherProps {
    together: NonNullable<ClubRetrospective['together']>;
    stillsOf: (film: Film) => string[];
    accent: string;
}

const oneDecimal = (n: number) => formatScore(Math.round(n * 10) / 10);

/**
 * The film the room loved most, set like a title over its own frames, which
 * the deck plays full screen behind it; and, under it, the one it loved
 * least, with a frame of its own. About the films, never about whose turn it
 * was.
 */
const ClubTogether: React.FC<ClubTogetherProps> = ({ together, stillsOf, accent }) => {
    const { loved, leastLoved } = together;
    const [stillFailed, setStillFailed] = useState(false);
    const still = leastLoved && !stillFailed ? stillsOf(leastLoved.film)[0] : undefined;
    return (
        <Slide align="bottom">
            <Reveal>
                <Eyebrow color={accent}>Our collective fav</Eyebrow>
                <h2 className="mt-2 font-serif text-5xl leading-[0.95] text-balance text-slate-50 sm:text-7xl">
                    <Link to={`/films/${loved.film.imdbID}`} className="hover:underline">
                        {loved.film.title}
                    </Link>
                </h2>
                <p className="mt-3 text-lg text-slate-300 sm:text-xl">
                    {loved.film.year.slice(0, 4)} ·{' '}
                    <span style={{ color: accent }}>{oneDecimal(loved.average)}</span> on average
                </p>
            </Reveal>
            {leastLoved && (
                <Reveal step={2}>
                    <div className="mt-8 flex items-center gap-4 border-t border-slate-100/15 pt-5 sm:gap-5">
                        {/* A frame of it, a little drained of colour; its poster
                            when it has no frames to show. */}
                        {still ? (
                            <Link
                                to={`/films/${leastLoved.film.imdbID}`}
                                className="block w-32 shrink-0 transition-transform hover:scale-[1.03] sm:w-48"
                            >
                                <img
                                    src={still}
                                    alt={leastLoved.film.title}
                                    className="aspect-video w-full rounded-sm object-cover shadow-lg ring-1 ring-slate-100/15 saturate-[0.6]"
                                    onError={() => setStillFailed(true)}
                                />
                            </Link>
                        ) : (
                            <Poster
                                src={leastLoved.film.poster}
                                title={leastLoved.film.title}
                                to={`/films/${leastLoved.film.imdbID}`}
                                className="w-14 sm:w-20"
                            />
                        )}
                        <div className="min-w-0">
                            <p className="text-sm text-slate-400 sm:text-base">
                                Lowest of the year
                            </p>
                            <Link
                                to={`/films/${leastLoved.film.imdbID}`}
                                className="mt-0.5 line-clamp-2 font-serif text-2xl leading-tight text-slate-100 hover:underline sm:text-3xl"
                            >
                                {leastLoved.film.title}
                            </Link>
                            <p className="mt-1 text-sm text-slate-400 sm:text-base">
                                {leastLoved.film.year.slice(0, 4)} ·{' '}
                                <span className="text-slate-200">
                                    {oneDecimal(leastLoved.average)}
                                </span>{' '}
                                on average
                            </p>
                        </div>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubTogether;
