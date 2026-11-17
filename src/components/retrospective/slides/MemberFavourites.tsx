import React from 'react';
import { Link } from 'react-router-dom';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { formatScore } from './format';

interface MemberFavouritesProps {
    scores: NonNullable<MemberRetrospective['scores']>;
    accent: string;
}

/**
 * The club film they scored highest this year, set like a title over its own
 * frames, which the deck plays full screen behind it; and, in a line under
 * it, the one they scored lowest.
 */
const MemberFavourites: React.FC<MemberFavouritesProps> = ({ scores, accent }) => {
    const { highest, lowest } = scores;
    return (
        <Slide align="bottom">
            <Reveal>
                <Eyebrow color={accent}>Your favourite</Eyebrow>
                <h2 className="mt-2 font-serif text-5xl leading-[0.95] text-balance text-slate-50 sm:text-7xl">
                    <Link to={`/films/${highest.film.imdbID}`} className="hover:underline">
                        {highest.film.title}
                    </Link>
                </h2>
                <p className="mt-3 text-lg text-slate-300 sm:text-xl">
                    {highest.film.year.slice(0, 4)} · you gave it{' '}
                    <span style={{ color: accent }}>{formatScore(highest.score)}</span>
                </p>
            </Reveal>
            {lowest && (
                <Reveal step={2}>
                    <p className="mt-8 border-t border-slate-100/15 pt-4 text-slate-400">
                        Your lowest:{' '}
                        <Link
                            to={`/films/${lowest.film.imdbID}`}
                            className="font-serif text-slate-200 hover:underline"
                        >
                            {lowest.film.title}
                        </Link>
                        , at {formatScore(lowest.score)}
                    </p>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberFavourites;
