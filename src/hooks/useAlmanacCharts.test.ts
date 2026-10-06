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

describe('useAlmanacCharts runtime and genre categories', () => {
    it('bands runtimes, shortest first, skipping films with no runtime', () => {
        const films = ['189 min', '75 min', '90 min', '119 min', '120 min', 'N/A'].map((runtime) =>
            makeFilm({ runtime })
        );
        const { result } = renderHook(() => useAlmanacCharts(films));
        act(() => result.current.setSelectedCategory('runtime'));

        expect(result.current.currentDonutChartData).toEqual([
            { name: 'Under 90 min', y: 1, share: 20 },
            { name: '90–119 min', y: 2, share: 40 },
            { name: '120–149 min', y: 1, share: 20 },
            { name: '150+ min', y: 1, share: 20 },
        ]);
    });

    it('counts a film under every one of its genres', () => {
        const films = ['Comedy, Drama', 'Drama, Horror', 'Drama', 'N/A'].map((genre) =>
            makeFilm({ genre })
        );
        const { result } = renderHook(() => useAlmanacCharts(films));
        act(() => result.current.setSelectedCategory('genre'));

        // Shares are of the three films with a genre, not of the four tags.
        expect(result.current.currentDonutChartData).toEqual([
            { name: 'Drama', y: 3, share: 100 },
            { name: 'Comedy', y: 1, share: (1 / 3) * 100 },
            { name: 'Horror', y: 1, share: (1 / 3) * 100 },
        ]);
    });

    it('lists a film under any of its genres', () => {
        const films = ['Comedy, Drama', 'Horror', 'Drama, Horror'].map((genre) =>
            makeFilm({ genre })
        );
        const { result } = renderHook(() => useAlmanacCharts(films));
        act(() => result.current.setSelectedCategory('genre'));
        clickBar(result.current.handleCategoryClick, 'Horror');

        expect(result.current.filteredFilmsForPieSlice.map((f) => f.genre)).toEqual([
            'Horror',
            'Drama, Horror',
        ]);
        expect(result.current.filteredListTitle).toBe('Horror Films');
    });

    it('counts the "Other" genre bar in films, not in folded genres', () => {
        // Nine genres big enough to keep, then one film carrying two small ones.
        const kept = 'ABCDEFGHI'
            .split('')
            .flatMap((genre) => [genre, genre].map((g) => makeFilm({ genre: g })));
        const films = [...kept, makeFilm({ genre: 'Y, Z' })];
        const { result } = renderHook(() => useAlmanacCharts(films));
        act(() => result.current.setSelectedCategory('genre'));

        const other = mobileBars(result.current.donutChartOptions).at(-1)!;
        expect(other).toMatchObject({ name: 'Other', y: 1 });
        clickBar(result.current.handleCategoryClick, 'Other');
        expect(result.current.filteredFilmsForPieSlice).toHaveLength(1);
        expect(result.current.filteredListTitle).toBe('Films in Other Genres');
    });
});

describe('useAlmanacCharts switching charts', () => {
    it('closes the film list when the chart changes', () => {
        const { result } = renderHook(() => useAlmanacCharts(fewCountries));
        clickBar(result.current.handleCategoryClick, 'A');
        expect(result.current.selectedPieSliceName).toBe('A');

        act(() => result.current.setSelectedCategory('decade'));
        expect(result.current.selectedPieSliceName).toBeNull();
        expect(result.current.filteredFilmsForPieSlice).toEqual([]);
    });

    it('keeps the film list when the chart already showing is picked again', () => {
        const { result } = renderHook(() => useAlmanacCharts(fewCountries));
        clickBar(result.current.handleCategoryClick, 'A');

        act(() => result.current.setSelectedCategory('country'));
        expect(result.current.selectedPieSliceName).toBe('A');
        expect(result.current.filteredFilmsForPieSlice).toHaveLength(2);
    });
});
