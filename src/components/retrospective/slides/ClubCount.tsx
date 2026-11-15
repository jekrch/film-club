import React from 'react';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { hoursOf, numberWord } from './format';

interface ClubCountProps {
    year: number;
    inProgress: boolean;
    count: NonNullable<ClubRetrospective['count']>;
    /** How many members are on the roster, for "scored by all four of us". */
    activeMembers: number;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/**
 * How many films the club watched together. Written for the real figures: a
 * club of four watching a dozen films is a full year, and the hours and the
 * comparison with last year carry that better than the count alone.
 */
const ClubCount: React.FC<ClubCountProps> = ({
    year,
    inProgress,
    count,
    activeMembers,
    accent,
    reel,
}) => {
    const change =
        count.previousYear === null
            ? null
            : count.films > count.previousYear
              ? `up from ${count.previousYear} in ${year - 1}`
              : count.films < count.previousYear
                ? `down from ${count.previousYear} in ${year - 1}`
                : `the same as in ${year - 1}`;
    const everyone = count.fullyScored === count.films && activeMembers > 1;

    return (
        <Slide reel={reel}>
            <Reveal>
                <Eyebrow color={accent}>
                    {year}
                    {inProgress ? ' · so far' : ''}
                </Eyebrow>
            </Reveal>
            <Reveal step={1}>
                <p className="mt-4 font-serif text-2xl text-slate-200 sm:text-3xl">We watched</p>
                <p className="font-serif text-[7rem] leading-none text-slate-50 sm:text-[10rem]">
                    <CountUp value={count.films} />
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">films together</p>
            </Reveal>
            <Reveal step={3}>
                <p className="mt-8 text-lg text-slate-300 sm:text-xl">
                    {hoursOf(count.minutes)} hours of film club screening time.
                </p>
            </Reveal>
            {(change || everyone) && (
                <Reveal step={4}>
                    <p className="mt-2 text-lg text-slate-400 sm:text-xl">
                        {change && <>That's {change}</>}
                        {change && everyone && ', and '}
                        {!change && everyone && 'And '}
                        {everyone && <>every one scored by all {numberWord(activeMembers)} of us</>}
                        .
                    </p>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubCount;
