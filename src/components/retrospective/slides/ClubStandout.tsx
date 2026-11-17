import React from 'react';
import { MAX_SCORE } from '../../../utils/ratingEditUtils';
import type { Standout, StandoutKind } from '../../../utils/retrospectiveUtils';
import Slide, { Eyebrow, Reveal } from '../Slide';
import { YearColumns } from './shared';
import { beat, listNames } from './format';

/** How a figure reads, and how tall its column stands among the others, 0 to 1. */
interface Scale {
    format: (value: number) => string;
    scale: (values: number[]) => (value: number) => number;
}

const tenths = (value: number): string => value.toFixed(1);
const whole = (value: number): string => String(value);
const percent = (value: number): string => `${value}%`;
const ofMost = (values: number[]) => (value: number) => value / Math.max(...values);

const SCORE: Scale = { format: tenths, scale: () => (value) => value / MAX_SCORE };
const COUNT: Scale = { format: whole, scale: ofMost };
const SHARE: Scale = { format: percent, scale: () => (value) => value / 100 };
const SPREAD: Scale = { format: tenths, scale: ofMost };
/**
 * Release years all sit around 1980, so the columns start a decade below the
 * earliest rather than at zero, where they'd stand level.
 */
const RELEASE: Scale = {
    format: whole,
    scale: (values) => {
        const floor = Math.floor(Math.min(...values) / 10) * 10 - 10;
        const top = Math.max(...values);
        return (value) => (value - floor) / (top - floor);
    },
};

interface Copy {
    headline: string;
    /** What the big figure counts, under it. */
    unit: string;
    /** "The next highest was 6.5, in 2022": the word after "next". */
    next: string;
    /** The chart's label. */
    chart: string;
    scale: Scale;
}

const COPY: Record<StandoutKind, Copy> = {
    'highest-score': {
        headline: 'Our highest-scoring year',
        unit: `our average score, out of ${MAX_SCORE}`,
        next: 'highest',
        chart: 'Average score by year',
        scale: SCORE,
    },
    'lowest-score': {
        headline: 'Our lowest-scoring year',
        unit: `our average score, out of ${MAX_SCORE}`,
        next: 'lowest',
        chart: 'Average score by year',
        scale: SCORE,
    },
    'most-films': {
        headline: 'Our most films in a year',
        unit: 'films together',
        next: 'most',
        chart: 'Films by year',
        scale: COUNT,
    },
    'most-hours': {
        headline: 'Our most hours together',
        unit: 'hours of film',
        next: 'most',
        chart: 'Hours by year',
        scale: COUNT,
    },
    'most-countries': {
        headline: 'Our most widely travelled year',
        unit: 'countries',
        next: 'most',
        chart: 'Countries by year',
        scale: COUNT,
    },
    'most-languages': {
        headline: 'Our most languages in a year',
        unit: 'languages',
        next: 'most',
        chart: 'Languages by year',
        scale: COUNT,
    },
    'least-english': {
        headline: 'Our least English-speaking year',
        unit: 'films not in English',
        next: 'highest share',
        chart: 'Films not in English, by year',
        scale: SHARE,
    },
    'least-american': {
        headline: 'Our least American year',
        unit: 'films made outside the United States',
        next: 'highest share',
        chart: 'Films made outside the US, by year',
        scale: SHARE,
    },
    oldest: {
        headline: 'Our deepest dig into the past',
        unit: 'the average year our films came out',
        next: 'oldest',
        chart: 'Average release year',
        scale: RELEASE,
    },
    newest: {
        headline: 'Our most modern year',
        unit: 'the average year our films came out',
        next: 'newest',
        chart: 'Average release year',
        scale: RELEASE,
    },
    agreed: {
        headline: 'The year we agreed most',
        unit: 'points between our highest and lowest score on a film, on average',
        next: 'closest',
        chart: 'Spread of our scores by year',
        scale: SPREAD,
    },
    divided: {
        headline: 'The year we agreed least',
        unit: 'points between our highest and lowest score on a film, on average',
        next: 'widest',
        chart: 'Spread of our scores by year',
        scale: SPREAD,
    },
    longest: {
        headline: 'Our longest films',
        unit: 'minutes a film, on average',
        next: 'longest',
        chart: 'Average runtime by year',
        scale: COUNT,
    },
    'most-months': {
        headline: 'Our steadiest year',
        unit: 'months with a screening',
        next: 'most',
        chart: 'Months with a screening, by year',
        scale: { format: whole, scale: () => (value) => value / 12 },
    },
};

interface ClubStandoutProps {
    year: number;
    inProgress: boolean;
    standout: Standout;
    accent: string;
}

/**
 * The one way the year stood out from all the others: said in a line, its
 * figure set large, the closest any other year came, and every year's figure
 * in a row of columns with this one in the accent.
 */
const ClubStandout: React.FC<ClubStandoutProps> = ({ year, inProgress, standout, accent }) => {
    const copy = COPY[standout.kind];
    const { format, scale } = copy.scale;
    const value = standout.years.find((y) => y.year === year)!.value;
    const figure = standout.share
        ? `${standout.share.count} of ${standout.share.of}`
        : format(value);

    return (
        <Slide>
            <Reveal>
                <Eyebrow color={accent}>What set {year} apart</Eyebrow>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-balance text-slate-50 sm:text-5xl">
                    {copy.headline}
                    {inProgress ? ', so far' : ''}
                </h2>
            </Reveal>

            <Reveal step={1}>
                <p
                    className="mt-6 font-figures figures-trim text-[5.5rem] leading-none lining-nums tabular-nums sm:mt-8 sm:text-[8rem]"
                    style={{ color: accent }}
                >
                    {figure}
                </p>
                <p className="mt-2 text-lg text-slate-300 sm:text-xl">{copy.unit}</p>
            </Reveal>

            <Reveal step={2}>
                <p className="mt-4 text-lg text-slate-400 sm:text-xl">
                    The next {copy.next} was {format(standout.next.value)}, in{' '}
                    {listNames(standout.next.years.map(String))}.
                </p>
            </Reveal>

            <Reveal step={3}>
                <div className="mt-8 sm:mt-10">
                    <YearColumns
                        label={copy.chart}
                        columns={standout.years}
                        year={year}
                        format={format}
                        scale={scale(standout.years.map((y) => y.value))}
                        accent={accent}
                        delay={beat(3) + 0.2}
                        tall
                    />
                </div>
            </Reveal>
        </Slide>
    );
};

export default ClubStandout;
