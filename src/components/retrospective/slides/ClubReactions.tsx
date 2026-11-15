import React from 'react';
import { REACTIONS } from '../../responses/reactions';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';

interface ClubReactionsProps {
    reactions: NonNullable<ClubRetrospective['reactions']>;
    accent: string;
}

/** Every tap the year's posts drew, the reaction we reached for most, and what drew the most. */
const ClubReactions: React.FC<ClubReactionsProps> = ({ reactions, accent }) => {
    const { total, topReaction, topThread } = reactions;
    const glyph = REACTIONS[topReaction.key];
    const subject =
        topThread.subject.kind === 'list'
            ? `${topThread.subject.member}'s list “${topThread.subject.title}”`
            : topThread.subject.member
              ? `${topThread.subject.member} on ${topThread.subject.title}`
              : `our night with ${topThread.subject.title}`;
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Reactions</Eyebrow>
            </Reveal>
            <Reveal step={1}>
                <div className="mt-4 flex items-center gap-6">
                    <span className="text-[5rem] leading-none sm:text-[7rem]" aria-hidden="true">
                        {glyph?.emoji}
                    </span>
                    <div>
                        <p className="font-serif text-5xl text-slate-50 sm:text-6xl">
                            <CountUp value={total} />
                        </p>
                        <p className="text-lg text-slate-300">
                            taps, and “{glyph?.label}” the most, {topReaction.count}{' '}
                            {topReaction.count === 1 ? 'time' : 'times'}
                        </p>
                    </div>
                </div>
            </Reveal>
            <Reveal step={2.5}>
                <p className="mt-8 text-lg text-slate-400">
                    Most reacted to: <span className="text-slate-200">{subject}</span>
                </p>
            </Reveal>
        </Slide>
    );
};

export default ClubReactions;
