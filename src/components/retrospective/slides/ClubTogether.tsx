import React from 'react';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import FeatureStill from '../FeatureStill';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { formatScore } from './format';

interface ClubTogetherProps {
    together: NonNullable<ClubRetrospective['together']>;
    lovedStills: string[];
    accent: string;
}

const oneDecimal = (n: number) => formatScore(Math.round(n * 10) / 10);

/**
 * The film the room loved most, shown large in its own frames with its poster
 * laid over the corner, and the one it loved least — about the films, never
 * about whose turn it was.
 */
const ClubTogether: React.FC<ClubTogetherProps> = ({ together, lovedStills, accent }) => {
    const { loved, leastLoved } = together;
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Together</Eyebrow>
                <h2 className="mt-3 font-serif text-2xl text-slate-200 sm:text-4xl">
                    The one we all loved
                </h2>
            </Reveal>
            {/* Side by side when there's width: the film's frames on the
                right, its poster and name on the left, so the hero is as wide
                as the column but only half as tall. Stacked on a phone, with
                the frame cut to a letterbox. */}
            <Reveal step={1}>
                <div className="mt-5 grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-8">
                    <FeatureStill
                        stills={lovedStills}
                        accent={accent}
                        aspectClass="[--aspect:21/9] [--aspect-tight:21/6] sm:[--aspect:16/9] sm:[--aspect-tight:16/6]"
                        className="sm:order-2"
                    />
                    <div className="flex items-end gap-4 sm:order-1">
                        <Poster
                            src={loved.film.poster}
                            title={loved.film.title}
                            to={`/films/${loved.film.imdbID}`}
                            className="w-16 shadow-2xl sm:w-28"
                        />
                        <div className="min-w-0 pb-1">
                            <p className="font-serif text-3xl leading-tight text-slate-50 sm:text-4xl">
                                {loved.film.title}
                            </p>
                            <p className="mt-1 font-serif text-lg" style={{ color: accent }}>
                                {oneDecimal(loved.average)}{' '}
                                <span className="text-sm text-slate-400">on average</span>
                            </p>
                        </div>
                    </div>
                </div>
            </Reveal>
            {leastLoved && (
                <Reveal step={3}>
                    <div
                        className="flex items-center gap-4 border-t border-slate-100/10"
                        style={{
                            marginTop: give('1.5rem', '0.75rem'),
                            paddingTop: give('1rem', '0.75rem'),
                        }}
                    >
                        <Poster
                            src={leastLoved.film.poster}
                            title={leastLoved.film.title}
                            to={`/films/${leastLoved.film.imdbID}`}
                            className="w-10"
                        />
                        <p className="text-slate-400">
                            And the one we detested most:{' '}
                            <span className="font-serif text-slate-200">
                                {leastLoved.film.title}
                            </span>
                            , at {oneDecimal(leastLoved.average)}
                        </p>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubTogether;
