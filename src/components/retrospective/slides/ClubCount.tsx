import React from 'react';
import { give } from '../../../hooks/useSqueeze';
import { MAX_SCORE } from '../../../utils/ratingEditUtils';
import type { ClubRetrospective } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { YearColumns } from './shared';
import { beat, hoursOf, numberWord } from './format';

const capitalised = (text: string): string => text.replace(/^./, (c) => c.toUpperCase());

type YearAverage = NonNullable<ClubRetrospective['count']>['averages'][number];

/** To the one decimal place a score is shown at, so a comparison matches what's printed. */
const rounded = (n: number): number => Math.round(n * 10) / 10;

/**
 * This year's average against the years before, in one sentence: a highest or
 * lowest yet when there are a few years behind it, else a change from the last
 * year with an average.
 */
const averageVersus = (averages: YearAverage[], year: number): string | null => {
    const now = averages.find((a) => a.year === year);
    const before = averages.filter((a) => a.year < year);
    if (!now || !before.length) return null;
    const score = rounded(now.average);
    if (before.length > 1 && before.every((b) => rounded(b.average) < score))
        return 'Our highest-scoring year yet.';
    if (before.length > 1 && before.every((b) => rounded(b.average) > score))
        return 'Our lowest-scoring year yet.';
    const last = before[before.length - 1];
    const lastScore = rounded(last.average);
    if (score === lastScore) return `The same as in ${last.year}.`;
    return `${score > lastScore ? 'Up' : 'Down'} from ${lastScore.toFixed(1)} in ${last.year}.`;
};

interface ClubCountProps {
    year: number;
    inProgress: boolean;
    count: NonNullable<ClubRetrospective['count']>;
    accent: string;
    /**
     * Leave the year's average score out, when a later slide makes the score
     * the year's standout and would rather not have it given away here.
     */
    hideAverage?: boolean;
    /** Stills for the reel across the top. */
    reel?: string[];
}

/**
 * How many films the club watched together. Written for the real figures: a
 * club of four watching a dozen films is a full year, and the hours and the
 * comparison with last year carry that better than the count alone. Last, the
 * year's average score beside the years before it, unless the standout slide
 * is saving it.
 */
const ClubCount: React.FC<ClubCountProps> = ({
    year,
    inProgress,
    count,
    accent,
    hideAverage = false,
    reel,
}) => {
    // One comparison, the most telling: a record if it is one, else last year.
    const before = count.previousYear;
    const versus =
        count.mostSince === 'ever'
            ? 'Our most in any year.'
            : count.mostSince !== null
              ? `Our most since ${count.mostSince}.`
              : before === null
                ? null
                : count.films > before
                  ? `Up from ${before} last year.`
                  : count.films === before
                    ? 'Same as last year.'
                    : inProgress
                      ? `${capitalised(numberWord(before - count.films))} more to match last year.`
                      : `Down from ${before} last year.`;
    const average = hideAverage ? null : (count.averages.find((a) => a.year === year) ?? null);
    const scoreVersus = averageVersus(count.averages, year);

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
                <p className="font-figures figures-trim lining-nums text-[7rem] leading-none text-slate-50 sm:text-[10rem]">
                    {count.films}
                </p>
                <p className="font-serif text-2xl text-slate-200 sm:text-3xl">films together</p>
            </Reveal>
            <Reveal step={3}>
                <p className="mt-8 text-lg text-slate-300 sm:text-xl">
                    {hoursOf(count.minutes)} hours in all.
                </p>
            </Reveal>
            {versus && (
                <Reveal step={4}>
                    <p className="mt-2 text-lg text-slate-400 sm:text-xl">{versus}</p>
                </Reveal>
            )}
            {average && (
                <Reveal step={5}>
                    <div
                        className="flex flex-wrap items-end gap-x-10 gap-y-4"
                        style={{ marginTop: give('2.5rem', '1rem') }}
                    >
                        {count.averages.length > 1 && (
                            <YearColumns
                                label="Average score by year"
                                columns={count.averages.map((a) => ({
                                    year: a.year,
                                    value: a.average,
                                }))}
                                year={year}
                                format={(v) => v.toFixed(1)}
                                scale={(v) => v / MAX_SCORE}
                                accent={accent}
                                delay={beat(5) + 0.2}
                            />
                        )}
                        <div className="text-lg leading-snug sm:text-xl">
                            <p className="text-slate-200">
                                Our average score:{' '}
                                <span style={{ color: accent }}>{average.average.toFixed(1)}</span>
                                <span className="text-slate-400"> / {MAX_SCORE}</span>
                            </p>
                            {scoreVersus && <p className="text-slate-400">{scoreVersus}</p>}
                        </div>
                    </div>
                </Reveal>
            )}
        </Slide>
    );
};

export default ClubCount;
