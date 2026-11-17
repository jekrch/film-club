import React from 'react';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { Poster, ScoreLine } from './shared';

interface MemberBreakawayProps {
    breakaway: NonNullable<MemberRetrospective['breakaway']>;
    accent: string;
}

/** The club film where their score sat furthest from everyone else's. */
const MemberBreakaway: React.FC<MemberBreakawayProps> = ({ breakaway, accent }) => {
    const { film, score, othersAverage, divergence } = breakaway;
    const room = Math.round(othersAverage * 10) / 10;
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>You saw this one differently</Eyebrow>
            </Reveal>
            <Reveal step={1}>
                <div className="mt-4 flex items-end gap-5">
                    <Poster
                        src={film.poster}
                        title={film.title}
                        to={`/films/${film.imdbID}`}
                        className="w-20 sm:w-28"
                    />
                    <div className="min-w-0">
                        <h2 className="font-serif text-3xl leading-tight text-slate-50 sm:text-5xl">
                            {film.title}
                        </h2>
                        <p className="mt-2 text-lg text-slate-300">
                            You liked it {divergence > 0 ? 'more' : 'less'} than the rest of us.
                        </p>
                    </div>
                </div>
            </Reveal>
            <Reveal step={2}>
                <ScoreLine
                    marks={[
                        { label: 'You', score, color: accent, emphasis: true },
                        { label: 'Everyone else', score: room, color: '#93a1b4' },
                    ]}
                />
            </Reveal>
        </Slide>
    );
};

export default MemberBreakaway;
