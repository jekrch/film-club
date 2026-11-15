import React from 'react';
import { motion } from 'framer-motion';
import { give } from '../../../hooks/useSqueeze';
import { prefersReducedMotion } from '../../../utils/motion';
import type { MemberRetrospective } from '../../../utils/retrospectiveUtils';
import CountUp from '../CountUp';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { Poster } from './shared';
import { calendarPosterWidth, hoursOf, MONTHS, yearOnYear } from './format';

interface MemberCountProps {
    year: number;
    inProgress: boolean;
    count: MemberRetrospective['count'];
    films: MemberRetrospective['films'];
    accent: string;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/** Seconds from the slide's start to a line at `step`, at the pace {@link Reveal} keeps. */
const beat = (step: number): number => 0.45 + step * 0.3;

/** A logged film's month, 0 for January, read from its date as written. */
const logMonth = (watchDate: string): number => parseInt(watchDate.slice(5, 7), 10) - 1;

/** The mark a logged film makes on the calendar, and its key. */
const LogDot: React.FC<{ accent: string; title?: string }> = ({ accent, title }) => (
    <span
        title={title}
        className="block h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
        style={{ backgroundColor: accent }}
    />
);

/**
 * Their year as twelve months of posters, the club films stacked up from a
 * line of month letters. Their own films, when they kept a log, hang below the
 * line as dots in their colour. Without a log there is nothing below the line,
 * so the calendar reads as complete, not as missing half.
 */
const PosterCalendar: React.FC<{
    films: MemberRetrospective['films'];
    accent: string;
    delay: number;
}> = ({ films, accent, delay }) => {
    const still = prefersReducedMotion();
    const club = MONTHS.map((_, m) =>
        films.club.filter((f) => f.parsedWatchDate.getUTCMonth() === m)
    );
    const own = MONTHS.map((_, m) => films.log.filter((l) => logMonth(l.entry.watchDate) === m));
    const width = calendarPosterWidth(Math.max(0, ...club.map((c) => c.length)));
    const hasOwn = films.log.length > 0;

    return (
        <div>
            {/* Three rows on one twelve-column grid, so every month's posters,
                letter and dots share a column and every letter one baseline. */}
            <div className="grid grid-cols-12 items-end gap-1 sm:gap-2">
                {club.map((screenings, month) => (
                    <div
                        key={MONTHS[month]}
                        className="flex w-full min-w-0 flex-col-reverse items-center gap-1"
                    >
                        {screenings.map((film, i) => (
                            <motion.div
                                key={film.imdbID}
                                className={`w-full ${width}`}
                                initial={still ? false : { opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: delay + month * 0.06 + i * 0.1 }}
                            >
                                <Poster src={film.poster} title={film.title} className="w-full" />
                            </motion.div>
                        ))}
                    </div>
                ))}
            </div>
            <div
                className="mt-1.5 grid grid-cols-12 gap-1 border-t border-slate-100/10 pt-1.5 sm:gap-2"
                aria-hidden="true"
            >
                {MONTHS.map((month) => (
                    <span
                        key={month}
                        className="text-center font-sans text-[10px] font-semibold tracking-wider text-slate-500 uppercase sm:text-xs"
                    >
                        {month[0]}
                    </span>
                ))}
            </div>
            {hasOwn && (
                <div className="mt-1.5 grid grid-cols-12 items-start gap-1 sm:gap-2">
                    {own.map((logged, month) => (
                        <motion.div
                            key={MONTHS[month]}
                            className="flex flex-wrap justify-center gap-[3px]"
                            initial={still ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: delay + 0.5 + month * 0.06 }}
                        >
                            {logged.map((l) => (
                                <LogDot
                                    key={`${l.imdbID}-${l.entry.watchDate}`}
                                    accent={accent}
                                    title={l.title ?? undefined}
                                />
                            ))}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Their club films in each year since their first, a column a year with this
 * one in their colour. Club films only, so a year is measured the same way
 * whether or not they kept a log in it.
 */
const YearsRow: React.FC<{
    history: MemberRetrospective['count']['history'];
    accent: string;
    delay: number;
}> = ({ history, accent, delay }) => {
    const still = prefersReducedMotion();
    const peak = Math.max(1, ...history.map((h) => h.withClub));
    const current = history[history.length - 1].year;
    const summary = history.map((h) => `${h.year}: ${h.withClub}`).join(', ');

    return (
        <div role="img" aria-label={`Club films by year — ${summary}`}>
            <p className="font-sans text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase sm:text-xs">
                Your years with the club
            </p>
            <div className="mt-2 flex items-end gap-2 sm:gap-3">
                {history.map((h, i) => {
                    const isNow = h.year === current;
                    return (
                        <div key={h.year} className="flex w-6 flex-col items-center sm:w-7">
                            <span
                                className="font-serif text-xs text-slate-500 tabular-nums sm:text-sm"
                                style={isNow ? { color: accent } : undefined}
                            >
                                {h.withClub}
                            </span>
                            <motion.div
                                className={`mt-1 w-full rounded-t-[2px] ${isNow ? '' : 'bg-slate-500/40'}`}
                                style={{
                                    height: `max(2px, calc(${h.withClub / peak} * ${give('2.75rem', '1.5rem')}))`,
                                    transformOrigin: 'bottom',
                                    ...(isNow ? { backgroundColor: accent } : {}),
                                }}
                                initial={still ? false : { scaleY: 0 }}
                                animate={{ scaleY: 1 }}
                                transition={{
                                    duration: 0.6,
                                    delay: delay + i * 0.06,
                                    ease: [0.22, 1, 0.36, 1] as const,
                                }}
                            />
                            <span
                                className="mt-1 text-[10px] text-slate-500 tabular-nums sm:text-xs"
                                style={isNow ? { color: accent } : undefined}
                            >
                                ’{String(h.year).slice(2)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/** One figure of the split, with the mark that keys it to the calendar. */
const KeyedFigure: React.FC<{ label: string; value: number; mark: React.ReactNode }> = ({
    label,
    value,
    mark,
}) => (
    <div>
        <dt className="flex items-center gap-2 text-sm text-slate-400">
            <span aria-hidden="true">{mark}</span>
            {label}
        </dt>
        <dd className="font-serif text-4xl text-slate-100">{value}</dd>
    </div>
);

/**
 * A member's films for the year: the total, the year as a calendar of posters,
 * and the year beside the ones before it.
 *
 * When they kept a log, the total is only ever the sum of two figures with two
 * labels — with the club, and on their own — since a log entry is never a club
 * watch. A member with nothing in their log gets no split at all, just their
 * films with the club, so the slide doesn't point at a log they haven't
 * started using.
 */
const MemberCount: React.FC<MemberCountProps> = ({
    year,
    inProgress,
    count,
    films,
    accent,
    reel,
}) => {
    const total = count.withClub + count.onOwn;
    const hasOwn = count.onOwn > 0;
    const hours = hoursOf(count.minutes.withClub + count.minutes.onOwn);
    const comparison = yearOnYear(count.history, inProgress);
    const closingStep = hasOwn ? 4.5 : 3.5;

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
                <p className="font-serif text-[6rem] leading-none text-slate-50 sm:text-[8.5rem]">
                    <CountUp value={total} />
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">
                    film{total === 1 ? '' : 's'}
                    {hasOwn ? '' : ' with the club'}
                </p>
            </Reveal>

            <Reveal step={2}>
                <div style={{ marginTop: give('2rem', '1rem') }}>
                    <PosterCalendar films={films} accent={accent} delay={beat(2) + 0.2} />
                </div>
            </Reveal>

            {hasOwn && (
                <Reveal step={3.5}>
                    <dl className="flex gap-10" style={{ marginTop: give('1.5rem', '0.75rem') }}>
                        <KeyedFigure
                            label="with the club"
                            value={count.withClub}
                            mark={<span className="block h-3 w-2 rounded-[1px] bg-slate-300/80" />}
                        />
                        <KeyedFigure
                            label="on your own"
                            value={count.onOwn}
                            mark={<LogDot accent={accent} />}
                        />
                    </dl>
                </Reveal>
            )}

            {(count.history.length > 1 || comparison || hours > 0) && (
                <Reveal step={closingStep}>
                    <div
                        className="flex flex-wrap items-end gap-x-10 gap-y-4"
                        style={{ marginTop: give('2rem', '1rem') }}
                    >
                        {count.history.length > 1 && (
                            <YearsRow
                                history={count.history}
                                accent={accent}
                                delay={beat(closingStep) + 0.2}
                            />
                        )}
                        <div className="text-lg leading-snug sm:text-xl">
                            {comparison && <p className="text-slate-200">{comparison}</p>}
                            {hours > 0 && <p className="text-slate-400">{hours} hours in all.</p>}
                        </div>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default MemberCount;
