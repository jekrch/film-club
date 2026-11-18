import { MAX_SCORE } from '../../../utils/ratingEditUtils';

/** The standout slides' scales and copy shape, kept apart from components for fast refresh. */

/** How a figure reads, and how tall its column stands among the others, 0 to 1. */
export interface Scale {
    format: (value: number) => string;
    scale: (values: number[]) => (value: number) => number;
}

/** What a standout slide says about one kind of record. */
export interface StandoutCopy {
    headline: string;
    /** What the big figure counts, under it. */
    unit: string;
    /** "The next highest was 6.5, in 2022": the word after "next". */
    next: string;
    /** The chart's label. */
    chart: string;
    scale: Scale;
}

const tenths = (value: number): string => value.toFixed(1);
const whole = (value: number): string => String(value);
const percent = (value: number): string => `${value}%`;
const ofMost = (values: number[]) => (value: number) => value / Math.max(...values);

export const SCORE: Scale = { format: tenths, scale: () => (value) => value / MAX_SCORE };
export const COUNT: Scale = { format: whole, scale: ofMost };
export const SHARE: Scale = { format: percent, scale: () => (value) => value / 100 };
export const SPREAD: Scale = { format: tenths, scale: ofMost };
/** Months of the year, out of twelve. */
export const MONTHS_OF_YEAR: Scale = { format: whole, scale: () => (value) => value / 12 };
/**
 * Release years all sit around 1980, so the columns start a decade below the
 * earliest rather than at zero, where they'd stand level.
 */
export const RELEASE: Scale = {
    format: whole,
    scale: (values) => {
        const floor = Math.floor(Math.min(...values) / 10) * 10 - 10;
        const top = Math.max(...values);
        return (value) => (value - floor) / (top - floor);
    },
};
