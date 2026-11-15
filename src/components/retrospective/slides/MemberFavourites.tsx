import React from 'react';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import FeatureStill from '../FeatureStill';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { formatScore } from './format';

interface MemberFavouritesProps {
    scores: NonNullable<MemberRetrospective['scores']>;
    /** Stills of the favourite. */
    stills: string[];
    accent: string;
}

/**
 * The club film they scored highest this year, large in its own frames with the
 * poster over the corner, and the one they scored lowest.
 */
const MemberFavourites: React.FC<MemberFavouritesProps> = ({ scores, stills, accent }) => {
    const { highest, lowest } = scores;
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Your favourite</Eyebrow>
            </Reveal>
            {/* Side by side when there's width: the film's frames on the
                right, its poster and name on the left, so the hero is as wide
                as the column but only half as tall. Stacked on a phone, with
                the frame cut to a letterbox. */}
            <Reveal step={1}>
                <div className="mt-5 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-8">
                    <FeatureStill
                        stills={stills}
                        accent={accent}
                        aspectClass="[--aspect:21/9] [--aspect-tight:21/6] sm:[--aspect:16/9] sm:[--aspect-tight:16/6]"
                        className="sm:order-2"
                    />
                    <div className="flex items-end gap-4 sm:order-1">
                        <Poster
                            src={highest.film.poster}
                            title={highest.film.title}
                            to={`/films/${highest.film.imdbID}`}
                            className="w-16 shadow-2xl sm:w-28"
                        />
                        <div className="min-w-0 pb-1">
                            <h2 className="font-serif text-3xl leading-tight text-slate-50 sm:text-4xl">
                                {highest.film.title}
                            </h2>
                            <p className="mt-1 font-serif text-xl" style={{ color: accent }}>
                                {formatScore(highest.score)}
                            </p>
                        </div>
                    </div>
                </div>
            </Reveal>
            {lowest && (
                <Reveal step={3}>
                    <div
                        className="flex items-center gap-4 border-t border-slate-100/10"
                        style={{
                            marginTop: give('1.5rem', '0.75rem'),
                            paddingTop: give('1rem', '0.75rem'),
                        }}
                    >
                        <Poster
                            src={lowest.film.poster}
                            title={lowest.film.title}
                            to={`/films/${lowest.film.imdbID}`}
                            className="w-10"
                        />
                        <p className="text-slate-400">
                            And the one you could have done without:{' '}
                            <span className="font-serif text-slate-200">{lowest.film.title}</span> (
                            {formatScore(lowest.score)})
                        </p>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberFavourites;
