import React from 'react';
import type { LoggedFilm, MemberRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { give } from '../../../hooks/useSqueeze';
import { Poster } from './shared';
import { listNames, MONTHS } from './format';

interface MemberLogProps {
    log: NonNullable<MemberRetrospective['log']>;
    onOwn: number;
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

const day = (logged: LoggedFilm): string => {
    const [, m, d] = logged.entry.watchDate.split('-').map(Number);
    return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
};

const linkOf = (l: LoggedFilm): string | undefined =>
    l.isClubFilm ? `/films/${l.imdbID}` : undefined;

/**
 * One figure and what it counts: on a phone a row, the figure right-aligned in
 * a column of its own; wider, a column with the label under the figure.
 */
const Stat: React.FC<{ value: number; children: React.ReactNode }> = ({ value, children }) => (
    <li className="flex items-baseline gap-4 sm:block">
        <span className="w-12 shrink-0 text-right font-serif text-3xl leading-none text-slate-50 tabular-nums sm:block sm:w-auto sm:text-left sm:text-4xl">
            {value}
        </span>
        <span className="text-base leading-snug text-slate-300 sm:mt-2 sm:block sm:text-sm">
            {children}
        </span>
    </li>
);

/** A film at one end of the year's log, with when it was watched. */
const Bookend: React.FC<{ label: string; logged: LoggedFilm }> = ({ label, logged }) => (
    <div className="flex min-w-0 items-center gap-3">
        <Poster
            src={logged.poster}
            title={logged.title ?? ''}
            to={linkOf(logged)}
            className="w-11 sm:w-14"
        />
        <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
                {label} · {day(logged)}
            </p>
            <p className="mt-1 line-clamp-2 font-serif text-base italic leading-snug text-slate-100 sm:text-lg">
                {logged.title}
            </p>
        </div>
    </div>
);

/** Their own log: how much, when, how steadily, and how much of it was theirs alone. */
const MemberLog: React.FC<MemberLogProps> = ({ log, onOwn, accent, reel }) => {
    const busiest = log.busiestMonth;
    const several = busiest.months.length > 1;
    return (
        <Slide reel={reel}>
            <Reveal>
                <Eyebrow color={accent}>On your own</Eyebrow>
                <p className="mt-4 font-figures figures-trim lining-nums text-[5.5rem] leading-none text-slate-50 sm:text-[8rem]">
                    {onOwn}
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">
                    film{onOwn === 1 ? '' : 's'} on your log
                </p>
            </Reveal>
            <Reveal step={1.5}>
                <ul
                    className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-8"
                    style={{ marginTop: give('2rem', '1rem') }}
                >
                    {log.solo > 0 && <Stat value={log.solo}>seen by nobody else in the club</Stat>}
                    {log.longestWeekStreak > 1 && (
                        <Stat value={log.longestWeekStreak}>weeks in a row with something new</Stat>
                    )}
                    {busiest.count > 1 && (
                        <Stat value={busiest.count}>
                            {several ? 'each ' : ''}in{' '}
                            {listNames(busiest.months.map((m) => MONTHS[m]))}, your busiest month
                            {several ? 's' : ''}
                        </Stat>
                    )}
                </ul>
            </Reveal>
            {log.first.imdbID !== log.last.imdbID && (
                <Reveal step={2.5}>
                    <div
                        className="grid grid-cols-2 gap-4 border-t border-slate-100/10 sm:gap-8"
                        style={{
                            marginTop: give('2rem', '1rem'),
                            paddingTop: give('1.25rem', '0.75rem'),
                        }}
                    >
                        <Bookend label="First" logged={log.first} />
                        <Bookend label="Latest" logged={log.last} />
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberLog;
