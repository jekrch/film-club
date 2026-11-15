import React from 'react';
import type { LoggedFilm, MemberRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { listNames, MONTHS, numberWord } from './format';

interface MemberLogProps {
    log: NonNullable<MemberRetrospective['log']>;
    onOwn: number;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

const day = (logged: LoggedFilm): string => {
    const [, m, d] = logged.entry.watchDate.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
};

const linkOf = (l: LoggedFilm): string | undefined =>
    l.isClubFilm ? `/films/${l.imdbID}` : undefined;

/** Their own log: how much, when, how steadily, and how much of it was theirs alone. */
const MemberLog: React.FC<MemberLogProps> = ({ log, onOwn, accent, reel }) => (
    <Slide reel={reel}>
        <Reveal>
            <Eyebrow color={accent}>On your own</Eyebrow>
            <p className="mt-4 font-serif text-[5.5rem] leading-none text-slate-50 sm:text-[8rem]">
                <CountUp value={onOwn} />
            </p>
            <p className="font-serif text-2xl text-slate-200 sm:text-3xl">
                film{onOwn === 1 ? '' : 's'} on your log
            </p>
        </Reveal>
        <Reveal step={1.5}>
            <ul
                className="space-y-1.5 text-lg text-slate-300 sm:text-xl"
                style={{ marginTop: give('1.5rem', '0.75rem') }}
            >
                {log.solo > 0 && (
                    <li>
                        <span className="font-serif text-slate-50">{log.solo}</span> that nobody
                        else in the club saw
                    </li>
                )}
                {log.longestWeekStreak > 1 && (
                    <li>
                        <span className="font-serif text-slate-50">
                            {numberWord(log.longestWeekStreak)}
                        </span>{' '}
                        weeks in a row with something new
                    </li>
                )}
                {log.busiestMonth.count > 1 && (
                    <li>
                        {listNames(log.busiestMonth.months.map((m) => MONTHS[m]))}{' '}
                        {log.busiestMonth.months.length > 1 ? 'were' : 'was'} your busiest, with{' '}
                        <span className="font-serif text-slate-50">{log.busiestMonth.count}</span>
                        {log.busiestMonth.months.length > 1 ? ' each' : ''}
                    </li>
                )}
            </ul>
        </Reveal>
        {log.first.imdbID !== log.last.imdbID && (
            <Reveal step={2.5}>
                <div
                    className="flex items-center gap-3 text-sm text-slate-400"
                    style={{ marginTop: give('2rem', '1rem') }}
                >
                    <Poster
                        src={log.first.poster}
                        title={log.first.title ?? ''}
                        to={linkOf(log.first)}
                        className="w-10"
                    />
                    <p className="min-w-0 flex-1">
                        First, on {day(log.first)}:{' '}
                        <em className="text-slate-200">{log.first.title}</em>. Latest, on{' '}
                        {day(log.last)}: <em className="text-slate-200">{log.last.title}</em>.
                    </p>
                    <Poster
                        src={log.last.poster}
                        title={log.last.title ?? ''}
                        to={linkOf(log.last)}
                        className="w-10"
                    />
                </div>
            </Reveal>
        )}
    </Slide>
);

export default MemberLog;
