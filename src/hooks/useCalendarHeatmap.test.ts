import { act, renderHook } from '@testing-library/react';
import Highcharts from 'highcharts';
import { calendarCells, useCalendarHeatmap } from './useCalendarHeatmap';
import { makeClubInfo, makeFilm, makeRating } from '../test-utils/factories';
import { Film } from '../types/film';

const watched = (watchDate: string, score?: number): Film =>
    makeFilm({
        movieClubInfo: makeClubInfo({
            watchDate,
            clubRatings: score === undefined ? [] : [makeRating({ score })],
        }),
    });

type HeatmapPoint = { x: number; y: number; value: number | null; borderColor: string };
const cellData = (options: Highcharts.Options) =>
    (options.series![0] as Highcharts.SeriesHeatmapOptions).data as HeatmapPoint[];

describe('calendarCells', () => {
    it('lays out every month from the first watched film to the last, gaps included', () => {
        const { years, cells } = calendarCells([
            watched('11/10/2020', 7),
            watched('02/03/2021', 8),
        ]);
        expect(years).toEqual([2020, 2021]);
        expect(cells.map((cell) => cell.key)).toEqual(['2020-11', '2020-12', '2021-01', '2021-02']);
        expect(cells.map((cell) => cell.month?.films.length ?? 0)).toEqual([1, 0, 0, 1]);
    });

    it('is empty with no watched films', () => {
        expect(calendarCells([makeFilm()])).toEqual({ years: [], cells: [] });
    });
});

describe('useCalendarHeatmap', () => {
    const films = [
        watched('11/10/2020', 6),
        watched('11/24/2020', 8),
        watched('01/05/2021'), // watched, never scored
    ];

    it('registers the heatmap series type', () => {
        // `seriesTypes` is on the runtime object but not in its typings.
        const { seriesTypes } = Highcharts as unknown as { seriesTypes: Record<string, unknown> };
        expect(seriesTypes.heatmap).toBeDefined();
    });

    it('places each month by column and year row, valued by films watched', () => {
        const { result } = renderHook(() => useCalendarHeatmap(films));
        expect(cellData(result.current.chartOptions)).toEqual([
            expect.objectContaining({ x: 10, y: 0, value: 2 }),
            expect.objectContaining({ x: 11, y: 0, value: 0 }),
            expect.objectContaining({ x: 0, y: 1, value: 1 }),
        ]);
    });

    it('shades by average score, leaving unscored months empty', () => {
        const { result } = renderHook(() => useCalendarHeatmap(films));
        act(() => result.current.setShade('score'));
        expect(cellData(result.current.chartOptions).map((cell) => cell.value)).toEqual([
            7,
            null,
            null,
        ]);
    });

    it('opens a month with films and ignores an empty one', () => {
        const { result } = renderHook(() => useCalendarHeatmap(films));
        const click = (index: number) => {
            const handler = result.current.chartOptions.plotOptions!.series!.point!.events!
                .click as (this: Highcharts.Point) => void;
            act(() => handler.call({ index } as Highcharts.Point));
        };
        click(1);
        expect(result.current.selectedMonth).toBeNull();
        click(0);
        expect(result.current.selectedMonth?.films).toHaveLength(2);
        const borders = cellData(result.current.chartOptions).map((cell) => cell.borderColor);
        expect(new Set(borders).size).toBe(2);
        click(0);
        expect(result.current.selectedMonth).toBeNull();
    });
});
