import { act, renderHook } from '@testing-library/react';
import Highcharts from 'highcharts';
import { monthOfYearScores, monthShades, useMonthOfYearChart } from './useMonthOfYearChart';
import { COPPER_BRIGHT, COPPER_DIM, copperShade } from '../utils/chartTheme';
import { makeClubInfo, makeFilm, makeRating } from '../test-utils/factories';
import { Film } from '../types/film';

/** A film watched on `watchDate` (MM/DD/YYYY), scored by one member per score given. */
const scored = (watchDate: string, ...scores: (number | null)[]): Film =>
    makeFilm({
        movieClubInfo: makeClubInfo({
            watchDate,
            clubRatings: scores.map((score, i) => makeRating({ user: `m${i}`, score })),
        }),
    });

describe('monthOfYearScores', () => {
    it('gathers every year’s films under the month they were watched in', () => {
        const films = [scored('03/20/2021', 6), scored('03/02/2024', 9), scored('01/05/2022', 7)];
        const months = monthOfYearScores(films);
        expect(months).toHaveLength(12);
        expect(months[2].average).toBe(7.5);
        expect(months[2].years).toEqual([2021, 2024]);
        expect(months[0].average).toBe(7);
        expect(months[1]).toEqual({ monthIndex: 1, average: null, films: [], years: [] });
    });

    it('lists a month’s films oldest first, across years', () => {
        const late = scored('03/20/2024', 6);
        const early = scored('03/02/2021', 9);
        expect(monthOfYearScores([late, early])[2].films.map((entry) => entry.film)).toEqual([
            early,
            late,
        ]);
    });

    it('counts each film once, however many members scored it', () => {
        // One film at 9 from three members, one at 4 from one: the films
        // average 6.5, where the ratings would average 7.75.
        const months = monthOfYearScores([scored('05/01/2022', 9, 9, 9), scored('05/09/2023', 4)]);
        expect(months[4].average).toBe(6.5);
    });

    it('leaves out unscored and undated films', () => {
        const months = monthOfYearScores([scored('06/01/2022', null), makeFilm()]);
        expect(months.every((month) => month.films.length === 0)).toBe(true);
    });
});

describe('copperShade', () => {
    it('runs from the dim end to the bright one', () => {
        expect(copperShade(0)).toBe(COPPER_DIM);
        expect(copperShade(1)).toBe(COPPER_BRIGHT);
        expect(copperShade(2)).toBe(COPPER_BRIGHT);
    });
});

describe('monthShades', () => {
    it('shades higher-scoring months brighter, and leaves empty months unshaded', () => {
        // Averages 6, 7.5 and 9: a 6–9 range, so 6 is the dim end and 9 the bright.
        const months = monthOfYearScores([
            scored('01/05/2021', 6),
            scored('03/02/2021', 7.5),
            scored('05/02/2021', 9),
        ]);
        const shades = monthShades(months);
        expect(shades[0]).toBe(COPPER_DIM);
        expect(shades[2]).toBe(copperShade(0.5));
        expect(shades[4]).toBe(COPPER_BRIGHT);
        expect(shades[1]).toBeNull();
    });
});

describe('useMonthOfYearChart', () => {
    const films = [scored('01/05/2021', 8), scored('03/02/2021', 6), scored('03/20/2023', 9)];

    const clickColumn = (options: Highcharts.Options, index: number) => {
        const click = options.plotOptions!.series!.point!.events!.click as (
            this: Highcharts.Point
        ) => void;
        act(() => click.call({ index } as Highcharts.Point));
    };

    it('draws a column per calendar month, empty months included', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        const series = result.current.chartOptions.series![0] as Highcharts.SeriesColumnOptions;
        expect((series.data as { y: number | null }[]).map((point) => point.y)).toEqual([
            8,
            null,
            7.5,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
        ]);
    });

    it('opens a month’s films on click, ignores an empty month, and closes on a second click', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        clickColumn(result.current.chartOptions, 1);
        expect(result.current.selectedMonth).toBeNull();
        clickColumn(result.current.chartOptions, 2);
        expect(result.current.selectedMonth?.films).toHaveLength(2);
        clickColumn(result.current.chartOptions, 2);
        expect(result.current.selectedMonth).toBeNull();
    });

    it('draws the club-wide average across the columns', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        expect(result.current.overallAverage).toBe(7.7);
        // The score axis, the first of the two.
        const [scoreAxis] = result.current.chartOptions.yAxis as Highcharts.YAxisOptions[];
        expect(scoreAxis.plotLines?.[0].value).toBe(7.7);
    });

    it('shades each column by its score', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        const series = result.current.chartOptions.series![0] as Highcharts.SeriesColumnOptions;
        const colors = (series.data as { color: string }[]).map((point) => point.color);
        expect(colors[0]).toBe(monthShades(result.current.months)[0]);
        expect(colors[0]).not.toBe(colors[2]);
    });

    it('draws how many films each month holds as a line on its own axis', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        const line = result.current.chartOptions.series![1] as Highcharts.SeriesLineOptions;
        expect(line.type).toBe('line');
        expect(line.yAxis).toBe(1);
        expect(line.data).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('outlines the open month’s column, and only that one', () => {
        const { result } = renderHook(() => useMonthOfYearChart(films));
        clickColumn(result.current.chartOptions, 2);
        const series = result.current.chartOptions.series![0] as Highcharts.SeriesColumnOptions;
        const widths = (series.data as { borderWidth: number }[]).map((point) => point.borderWidth);
        expect(widths.filter((width) => width === 2)).toHaveLength(1);
        expect(widths[2]).toBe(2);
    });
});
