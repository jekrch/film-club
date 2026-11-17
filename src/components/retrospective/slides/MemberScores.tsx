import React from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '../../../utils/motion';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';

interface MemberScoresProps {
    scores: NonNullable<MemberRetrospective['scores']>;
    accent: string;
}

/**
 * How they scored the club's films this year: the average, and the shape of it.
 * Only club scores count here; their own log gets one line of its own.
 */
const MemberScores: React.FC<MemberScoresProps> = ({ scores, accent }) => {
    const still = prefersReducedMotion();
    const tallest = Math.max(1, ...scores.distribution.map((d) => d.count));
    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>Your club scores</Eyebrow>
                <p className="mt-4 font-figures figures-trim lining-nums text-[5.5rem] leading-none text-slate-50 sm:text-[8rem]">
                    {scores.average.toFixed(1)}
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">
                    your average score across the {scores.count} club film
                    {scores.count === 1 ? '' : 's'} you rated
                </p>
            </Reveal>
            <Reveal step={1.5}>
                <p className="mt-8 text-sm text-slate-400">
                    How many club films you gave each score
                </p>
                <div className="mt-3 flex max-w-lg items-end gap-1.5 sm:gap-2">
                    {scores.distribution.map(({ score, count }) => (
                        <div
                            key={score}
                            className="flex flex-1 flex-col items-center gap-1"
                            aria-label={`Score ${score}: ${count} film${count === 1 ? '' : 's'}`}
                        >
                            {count > 0 && (
                                <span className="font-serif text-xs text-slate-400">{count}</span>
                            )}
                            <motion.div
                                className="w-full origin-bottom rounded-t-sm"
                                style={{
                                    height: `${Math.max(2, (count / tallest) * 96)}px`,
                                    backgroundColor: count ? accent : 'rgba(242,245,248,0.12)',
                                }}
                                initial={still ? false : { scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{ delay: 0.5 + score * 0.05, duration: 0.6 }}
                            />
                            {/* The x axis is the popcorn scale: a bucket over each score, empty at 0. */}
                            <img
                                src="/popcorn.svg"
                                alt=""
                                aria-hidden="true"
                                className={`mt-1 h-4 w-4 sm:h-5 sm:w-5 ${
                                    score === 0 ? 'opacity-60 brightness-50' : ''
                                }`}
                            />
                            <span className="font-serif text-xs text-slate-500">{score}</span>
                        </div>
                    ))}
                </div>
            </Reveal>
            {scores.logAverage !== null && (
                <Reveal step={2.5}>
                    <p className="mt-6 text-slate-400">
                        Not counted above: the {scores.logCount} film
                        {scores.logCount === 1 ? '' : 's'} you scored in your own log averaged{' '}
                        {scores.logAverage.toFixed(1)}.
                    </p>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberScores;
