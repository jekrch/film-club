import { Film } from '../types/film';
import { parseWatchDate } from './filmUtils';
import { parseRuntime } from './statUtils';

/**
 * The almanac's figures, as plain functions over a list of films.
 *
 * `useAlmanacCharts` draws these as charts; the retrospective reads the same
 * figures for one year's films. Both call these, so the two can never disagree
 * about how many films came from a country or how long the club went between
 * screenings.
 */

export type ChartCategory = 'country' | 'language' | 'decade' | 'runtime' | 'genre';

/** The chip label for each category. */
export const CATEGORY_LABELS: Record<ChartCategory, string> = {
    country: 'Country',
    language: 'Language',
    decade: 'Decade',
    runtime: 'Runtime',
    genre: 'Genre',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as ChartCategory[];

export type FilmWithDate = Film & { parsedWatchDate: Date };

/** Whole days between two dates, read in UTC — the calendar `parseWatchDate` builds in. */
export const daysBetween = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
    const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
    return Math.floor(Math.abs(utc2 - utc1) / oneDay);
};

/** Runtime bands, shortest first; a film falls in the first whose `under` it is below. */
export const RUNTIME_BANDS = [
    { under: 90, label: 'Under 90 min' },
    { under: 120, label: '90–119 min' },
    { under: 150, label: '120–149 min' },
    { under: Infinity, label: '150+ min' },
];

/** The entries of a comma-separated field, leaving out blanks and "N/A". */
export const listed = (field: string | null | undefined): string[] =>
    (field ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry && entry.toLowerCase() !== 'n/a');

/** `"1993"` or `"1993–1995"` → `"1990s"`; null for a year that doesn't parse. */
export const decadeOf = (year: string | null | undefined): string | null => {
    const yearNum = parseInt(year?.substring(0, 4) || '0', 10);
    return !isNaN(yearNum) && yearNum > 1000 ? `${Math.floor(yearNum / 10) * 10}s` : null;
};

/**
 * The labels a film is counted under in a category: its first country or
 * language, its decade, its runtime band, or every one of its genres. Genre is
 * the one category a film can be counted under more than once — OMDb lists a
 * film's genres alphabetically, so its first is no truer than its last.
 */
export const categoryValuesOf = (film: Film, category: ChartCategory): string[] => {
    switch (category) {
        case 'country':
            return listed(film?.country).slice(0, 1);
        case 'language':
            return listed(film?.language).slice(0, 1);
        case 'decade': {
            const decade = decadeOf(film.year);
            return decade ? [decade] : [];
        }
        case 'runtime': {
            const minutes = parseRuntime(film.runtime);
            return minutes ? [RUNTIME_BANDS.find((band) => minutes < band.under)!.label] : [];
        }
        case 'genre':
            return listed(film?.genre);
    }
};

/** Where a category value sits in its category's natural order; unordered categories return null. */
export const orderOf = (category: ChartCategory, value: string): number | null => {
    switch (category) {
        case 'decade':
            return parseInt(value, 10);
        case 'runtime':
            return RUNTIME_BANDS.findIndex((band) => band.label === value);
        default:
            return null;
    }
};

export const isOrdered = (category: ChartCategory): boolean =>
    category === 'decade' || category === 'runtime';

/** A slice or bar: how many films carry the value, and what percentage of films that is. */
export type CategoryPoint = { name: string; y: number; share: number; color?: string };

/**
 * How many films carry each value of a category, ordered categories in their
 * order and the rest largest first.
 *
 * `share` is of films, not of the slices: for genre, where a film counts under
 * each of its genres, the two differ.
 */
export const categoryCounts = (films: Film[], category: ChartCategory): CategoryPoint[] => {
    const counts = new Map<string, number>();
    let filmsCounted = 0;
    films.forEach((film) => {
        const values = categoryValuesOf(film, category);
        if (values.length) filmsCounted++;
        values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    });
    return Array.from(counts.entries())
        .map(([name, y]) => ({ name, y, share: (y / filmsCounted) * 100 }))
        .sort((a, b) =>
            isOrdered(category)
                ? orderOf(category, a.name)! - orderOf(category, b.name)! ||
                  a.name.localeCompare(b.name)
                : b.y - a.y
        );
};

/** The films with a parseable club watch date, earliest first. */
export const sortByWatchDate = (films: Film[]): FilmWithDate[] =>
    films
        .map((film) => ({ film, date: parseWatchDate(film.movieClubInfo?.watchDate) }))
        .filter((f): f is { film: Film; date: Date } => f.date !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(({ film, date }) => ({ ...film, parsedWatchDate: date }));

/** The gap between one screening and the next. */
export interface MeetingInterval {
    /** Index into the sorted films of the screening that *ends* the interval. */
    index: number;
    startDate: Date;
    endDate: Date;
    days: number;
    /** The film at the end of the interval. */
    film: FilmWithDate;
}

/** Each gap between consecutive screenings, in order. `sorted` is {@link sortByWatchDate}'s output. */
export const meetingIntervals = (sorted: FilmWithDate[]): MeetingInterval[] =>
    sorted.slice(1).map((film, i) => {
        const startDate = sorted[i].parsedWatchDate;
        const endDate = film.parsedWatchDate;
        return { index: i + 1, startDate, endDate, days: daysBetween(startDate, endDate), film };
    });

export interface IntervalDetail {
    startDate: Date;
    endDate: Date;
    days: number;
    films: FilmWithDate[];
}
