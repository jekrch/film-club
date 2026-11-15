import React from 'react';
import { motion } from 'framer-motion';
import type { FilmWithDate } from '../../../utils/almanacUtils';
import { prefersReducedMotion } from '../../../utils/motion';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { Poster } from './shared';
import { calendarPosterWidth, listNames, MONTHS, numberWord } from './format';

interface ClubCalendarProps {
    calendar: NonNullable<ClubRetrospective['calendar']>;
    films: FilmWithDate[];
    inProgress: boolean;
    accent: string;
}

/**
 * The year as a row of months, one poster-dot per screening, then the shape of
 * it in words: where it began and ended, when it was busiest, the longest gap.
 */
const ClubCalendar: React.FC<ClubCalendarProps> = ({ calendar, films, inProgress, accent }) => {
    const still = prefersReducedMotion();
    const byMonth = MONTHS.map((_, month) =>
        films.filter((f) => f.parsedWatchDate.getUTCMonth() === month)
    );
    const { first, last, busiestMonth, longestGap } = calendar;
    const busiest = busiestMonth.count > 1 ? busiestMonth.months : [];
    const monthOf = (film: typeof first) =>
        MONTHS[films.find((f) => f.imdbID === film.imdbID)!.parsedWatchDate.getUTCMonth()];
    const width = calendarPosterWidth(busiestMonth.count);

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>The calendar</Eyebrow>
                <h2 className="mt-3 font-serif text-2xl leading-snug text-balance text-slate-50 sm:text-4xl">
                    {first.imdbID === last.imdbID ? (
                        <>
                            One night, in {monthOf(first)}: <em>{first.title}</em>
                        </>
                    ) : (
                        <>
                            From <em>{first.title}</em> in {monthOf(first)} to <em>{last.title}</em>{' '}
                            in {monthOf(last)}
                            {inProgress ? ', so far' : ''}
                        </>
                    )}
                </h2>
            </Reveal>

            <Reveal step={1}>
                {/* No fixed height: the row is as tall as the fullest month, and
                    every column sits on the same baseline of month letters. */}
                <div className="mt-6 grid grid-cols-12 items-end gap-1 sm:mt-8 sm:gap-2">
                    {byMonth.map((screenings, month) => (
                        <div key={month} className="flex min-w-0 flex-col items-center gap-1.5">
                            <div className="flex w-full flex-col-reverse items-center gap-1">
                                {screenings.map((film, i) => (
                                    <motion.div
                                        key={film.imdbID}
                                        className={`w-full ${width}`}
                                        initial={still ? false : { opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 + month * 0.06 + i * 0.1 }}
                                    >
                                        <Poster
                                            src={film.poster}
                                            title={film.title}
                                            className="w-full"
                                        />
                                    </motion.div>
                                ))}
                            </div>
                            <span
                                className="font-sans text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs"
                                style={busiest.includes(month) ? { color: accent } : undefined}
                            >
                                {MONTHS[month][0]}
                            </span>
                        </div>
                    ))}
                </div>
            </Reveal>

            <Reveal step={2.5}>
                <div className="mt-6 space-y-2 text-lg text-slate-300 sm:mt-8 sm:text-xl">
                    {busiest.length > 0 && (
                        <p>
                            {listNames(busiest.map((m) => MONTHS[m]))}{' '}
                            {busiest.length > 1 ? 'were' : 'was'} the busiest, with{' '}
                            {numberWord(busiestMonth.count)} screenings
                            {busiest.length > 1 ? ' each' : ''}.
                        </p>
                    )}
                    {longestGap && (
                        <p className="text-slate-400">
                            The longest gap: {longestGap.days} days, between{' '}
                            <em>{longestGap.from.title}</em> and <em>{longestGap.to.title}</em>.
                        </p>
                    )}
                </div>
            </Reveal>
        </Slide>
    );
};

export default ClubCalendar;
