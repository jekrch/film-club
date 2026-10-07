import { Film } from '../types/film';
import { parseWatchDate } from './filmUtils';
import { calculateClubAverage } from './ratingUtils';

/** A watched film, when it was watched, and the club's average score for it. */
export interface DatedFilm {
    film: Film;
    watchDate: Date;
    /** Null when nobody has scored it. */
    score: number | null;
}

/** A month the club watched at least one film in. */
export interface MonthFilms {
    /** `2021-03`: sorts chronologically, and names the month across renders. */
    key: string;
    /** The first of the month, UTC, as watch dates are. */
    month: Date;
    /** In the order they were watched. */
    films: DatedFilm[];
    /** The mean of the month's film scores, to one decimal; null if none was scored. */
    average: number | null;
}

export const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

export const mean = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

const monthName = (index: number, month: 'short' | 'long'): string =>
    new Date(Date.UTC(2000, index, 1)).toLocaleDateString('en-US', { month, timeZone: 'UTC' });

/** "Jan" through "Dec". */
export const SHORT_MONTH_NAMES = Array.from({ length: 12 }, (_, i) => monthName(i, 'short'));

/** "January" through "December". */
export const LONG_MONTH_NAMES = Array.from({ length: 12 }, (_, i) => monthName(i, 'long'));

/** `2021-03` for any day in March 2021. */
export const monthKey = (date: Date): string =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

/** "Mar ’21": short enough to sit under a column. */
export const formatShortMonth = (month: Date): string =>
    `${month.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} ’${String(
        month.getUTCFullYear()
    ).slice(2)}`;

/** "March 2021". */
export const formatLongMonth = (month: Date): string =>
    month.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "Mar 2, 2021". */
export const formatDay = (date: Date): string =>
    date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });

/** Every film with a watch date, oldest first, with its club average. */
export const datedFilms = (films: Film[]): DatedFilm[] =>
    films
        .flatMap((film) => {
            const watchDate = parseWatchDate(film.movieClubInfo?.watchDate);
            return watchDate
                ? [
                      {
                          film,
                          watchDate,
                          score: calculateClubAverage(film.movieClubInfo?.clubRatings),
                      },
                  ]
                : [];
        })
        .sort((a, b) => a.watchDate.getTime() - b.watchDate.getTime());

/**
 * The club's watched films grouped by month, oldest month first. A month's
 * average is the mean of its films' club averages: each film counts once
 * however many members scored it, so a month reads as "how good were the films"
 * rather than "how generous was whoever showed up".
 */
export const monthlyFilms = (films: Film[]): MonthFilms[] => {
    const byMonth = new Map<string, DatedFilm[]>();
    datedFilms(films).forEach((entry) => {
        const key = monthKey(entry.watchDate);
        byMonth.set(key, [...(byMonth.get(key) ?? []), entry]);
    });

    // Already in watch order, so the months come out oldest first.
    return Array.from(byMonth.entries()).map(([key, entries]) => {
        const scores = entries.flatMap((entry) => (entry.score === null ? [] : [entry.score]));
        const [year, month] = key.split('-').map(Number);
        return {
            key,
            month: new Date(Date.UTC(year, month - 1, 1)),
            films: entries,
            average: scores.length ? roundToTenth(mean(scores)) : null,
        };
    });
};
