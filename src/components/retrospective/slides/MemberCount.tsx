import React from 'react';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { hoursOf } from './format';

interface MemberCountProps {
    year: number;
    inProgress: boolean;
    count: MemberRetrospective['count'];
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/**
 * A member's films for the year. Two figures with two labels — with the club,
 * and on their own — and the total only as the sum of them: a log entry is
 * never a club watch, and the slide doesn't pretend it is.
 */
const MemberCount: React.FC<MemberCountProps> = ({ year, inProgress, count, accent, reel }) => {
    const total = count.withClub + count.onOwn;
    const hours = hoursOf(count.minutes.withClub + count.minutes.onOwn);
    return (
        <Slide reel={reel}>
            <Reveal>
                <Eyebrow color={accent}>
                    {year}
                    {inProgress ? ' · so far' : ''}
                </Eyebrow>
            </Reveal>
            <Reveal step={1}>
                <p className="mt-4 font-serif text-2xl text-slate-200 sm:text-3xl">You watched</p>
                <p className="font-serif text-[7rem] leading-none text-slate-50 sm:text-[10rem]">
                    <CountUp value={total} />
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">
                    film{total === 1 ? '' : 's'}
                </p>
            </Reveal>
            <Reveal step={3}>
                <dl className="mt-8 grid max-w-md grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-slate-400">with the club</dt>
                        <dd className="font-serif text-4xl text-slate-100">{count.withClub}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-slate-400">on your own</dt>
                        <dd className="font-serif text-4xl text-slate-100">{count.onOwn}</dd>
                    </div>
                </dl>
            </Reveal>
            {hours > 0 && (
                <Reveal step={4}>
                    <p className="mt-6 text-lg text-slate-300">{hours} hours in all.</p>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberCount;
