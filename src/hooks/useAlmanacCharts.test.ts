import { act, renderHook } from '@testing-library/react';
import Highcharts from 'highcharts';
import { useAlmanacCharts } from './useAlmanacCharts';
import { makeFilm } from '../test-utils/factories';
import { Film } from '../types/film';

// Twelve countries, "A" through "L", with 12 films down to 1: more than the
// narrow-screen bar chart draws, so the smallest three fold into "Other".
const COUNTRIES = 'ABCDEFGHIJKL'.split('');
const manyCountries: Film[] = COUNTRIES.flatMap((country, i) =>
    Array.from({ length: COUNTRIES.length - i }, () => makeFilm({ country }))
);
const fewCountries: Film[] = ['A', 'A', 'B', 'C'].map((country) => makeFilm({ country }));

/** The data the narrow-screen responsive rule draws as bars. */
const mobileBars = (options: Highcharts.Options) => {
    const rule = options.responsive!.rules![0];
    const series = rule.chartOptions!.series![0] as Highcharts.SeriesBarOptions;
    return series.data as { name: string; y: number }[];
};

const clickBar = (handler: (point: Highcharts.Point) => void, name: string) =>
    act(() => handler({ name } as Highcharts.Point));

describe('useAlmanacCharts narrow-screen bars', () => {
    it('folds the smallest categories into an "Other" bar past the limit', () => {
        const { result } = renderHook(() => useAlmanacCharts(manyCountries));
        const bars = mobileBars(result.current.donutChartOptions);

        expect(bars).toHaveLength(10);
        expect(bars.slice(0, 9).map((b) => b.name)).toEqual('ABCDEFGHI'.split(''));
        // J, K and L: 3 + 2 + 1 films.
        expect(bars[9]).toMatchObject({ name: 'Other', y: 6 });
    });

    it('keeps every slice on the wide-screen donut', () => {
        const { result } = renderHook(() => useAlmanacCharts(manyCountries));
        const pie = result.current.donutChartOptions.series![0] as Highcharts.SeriesPieOptions;
        expect(pie.data).toHaveLength(12);
    });

    it('lists the folded-in films when "Other" is clicked', () => {
        const { result } = renderHook(() => useAlmanacCharts(manyCountries));
        clickBar(result.current.handleCategoryClick, 'Other');

        expect(result.current.filteredFilmsForPieSlice).toHaveLength(6);
        expect(
            new Set(result.current.filteredFilmsForPieSlice.map((film) => film.country))
        ).toEqual(new Set(['J', 'K', 'L']));
        expect(result.current.filteredListTitle).toBe('Films from Other Countries');
    });

    it('still filters a named bar to its own films', () => {
        const { result } = renderHook(() => useAlmanacCharts(manyCountries));
        clickBar(result.current.handleCategoryClick, 'A');

        expect(result.current.filteredFilmsForPieSlice).toHaveLength(12);
        expect(result.current.filteredListTitle).toBe('Films from A');
    });

    it('draws every category when there are few enough to fit', () => {
        const { result } = renderHook(() => useAlmanacCharts(fewCountries));
        expect(mobileBars(result.current.donutChartOptions).map((b) => b.name)).toEqual([
            'A',
            'B',
            'C',
        ]);
    });

    it('never folds decades, which read in order', () => {
        const byDecade = Array.from({ length: 12 }, (_, i) =>
            makeFilm({ year: String(1900 + i * 10) })
        );
        const { result } = renderHook(() => useAlmanacCharts(byDecade));
        act(() => result.current.setSelectedCategory('decade'));

        const bars = mobileBars(result.current.donutChartOptions);
        expect(bars).toHaveLength(12);
        expect(bars.map((b) => b.name)).not.toContain('Other');
    });
});
