import { act, renderHook } from '@testing-library/react';
import Highcharts from 'highcharts';
import {
    memberMonthlyScores,
    nextFocusedMembers,
    useMemberTrendsChart,
} from './useMemberTrendsChart';
import { makeClubInfo, makeFilm, makeMember, makeRating } from '../test-utils/factories';
import { ClubRating, Film } from '../types/film';

const andy = makeMember({ name: 'Andy', color: 'emerald-300' });
const gabe = makeMember({ name: 'Gabe', color: 'indigo-300' });
const mark = makeMember({ name: 'Mark', color: undefined });

/** A film watched on `watchDate` (MM/DD/YYYY) with the given ratings. */
const filmOn = (watchDate: string, ratings: ClubRating[]): Film =>
    makeFilm({ movieClubInfo: makeClubInfo({ watchDate, clubRatings: ratings }) });

const rated = (user: string, score: number | null) => makeRating({ user, score });

describe('memberMonthlyScores', () => {
    it('averages each member’s scores month by month, oldest first', () => {
        const films = [
            filmOn('03/20/2021', [rated('andy', 6)]),
            filmOn('01/05/2021', [rated('andy', 9)]),
            filmOn('03/02/2021', [rated('andy', 8)]),
        ];
        const [trend] = memberMonthlyScores(films, [andy]);
        expect(trend.months.map((m) => [m.key, m.average])).toEqual([
            ['2021-01', 9],
            ['2021-03', 7],
        ]);
        expect(trend.months[1].films.map((entry) => entry.film)).toEqual([films[2], films[0]]);
    });

    it('carries the member’s own score, not the club’s', () => {
        const films = [filmOn('05/01/2022', [rated('andy', 4), rated('gabe', 9)])];
        const [andyTrend] = memberMonthlyScores(films, [andy]);
        expect(andyTrend.months[0].films[0].score).toBe(4);
    });

    it('matches ratings to members whatever the case, and skips unscored films', () => {
        const films = [
            filmOn('06/01/2022', [rated('ANDY', 5)]),
            filmOn('06/09/2022', [rated('andy', null)]),
        ];
        const [trend] = memberMonthlyScores(films, [andy]);
        expect(trend.months[0].films).toHaveLength(1);
        expect(trend.months[0].average).toBe(5);
    });

    it('leaves out members who haven’t scored anything', () => {
        const films = [filmOn('06/01/2022', [rated('andy', 5)])];
        expect(memberMonthlyScores(films, [andy, gabe]).map((t) => t.name)).toEqual(['Andy']);
    });

    it('gives members without a color of their own a distinct fallback', () => {
        const films = [filmOn('06/01/2022', [rated('andy', 5), rated('mark', 5)])];
        const [andyTrend, markTrend] = memberMonthlyScores(films, [andy, mark]);
        expect(andyTrend.color).toBe('#6ee7b7');
        expect(markTrend.color).toMatch(/^#/);
        expect(markTrend.color).not.toBe(andyTrend.color);
    });
});

describe('nextFocusedMembers', () => {
    const all = ['Andy', 'Gabe', 'Jacob'];

    it('singles a member out when everyone is shown', () => {
        expect(nextFocusedMembers([], 'Gabe', all)).toEqual(['Gabe']);
    });

    it('adds a hidden member alongside those singled out', () => {
        expect(nextFocusedMembers(['Gabe'], 'Andy', all)).toEqual(['Gabe', 'Andy']);
    });

    it('takes a shown member away again', () => {
        expect(nextFocusedMembers(['Gabe', 'Andy'], 'Gabe', all)).toEqual(['Andy']);
    });

    it('goes back to everyone when the last one is taken away', () => {
        expect(nextFocusedMembers(['Gabe'], 'Gabe', all)).toEqual([]);
    });

    it('goes back to everyone when the last one missing is added', () => {
        expect(nextFocusedMembers(['Gabe', 'Andy'], 'Jacob', all)).toEqual([]);
    });
});

describe('useMemberTrendsChart', () => {
    const films = [
        filmOn('01/05/2021', [rated('andy', 8)]),
        filmOn('02/02/2021', [rated('andy', 6)]),
        filmOn('02/16/2021', [rated('andy', 9)]),
    ];

    const clickPoint = (options: Highcharts.Options, member: string, index: number) => {
        const click = options.plotOptions!.series!.point!.events!.click as (
            this: Highcharts.Point
        ) => void;
        act(() => click.call({ series: { name: member }, index } as Highcharts.Point));
    };

    it('plots one point per month, at the month’s average', () => {
        const { result } = renderHook(() => useMemberTrendsChart(films, [andy]));
        const series = result.current.chartOptions.series![0] as Highcharts.SeriesLineOptions;
        expect(series.data).toEqual([
            [Date.UTC(2021, 0, 1), 8],
            [Date.UTC(2021, 1, 1), 7.5],
        ]);
    });

    it('opens a month’s films on click, and closes them on a second click', () => {
        const { result } = renderHook(() => useMemberTrendsChart(films, [andy]));
        clickPoint(result.current.chartOptions, 'Andy', 1);
        expect(result.current.selectedPoint?.month.key).toBe('2021-02');
        expect(result.current.selectedPoint?.month.films).toHaveLength(2);
        clickPoint(result.current.chartOptions, 'Andy', 1);
        expect(result.current.selectedPoint).toBeNull();
    });

    it('marks no range on the chart when a point is open', () => {
        const { result } = renderHook(() => useMemberTrendsChart(films, [andy]));
        clickPoint(result.current.chartOptions, 'Andy', 0);
        const xAxis = result.current.chartOptions.xAxis as Highcharts.XAxisOptions;
        expect(xAxis.plotBands).toBeUndefined();
        expect(xAxis.plotLines).toBeUndefined();
    });

    describe('legend', () => {
        const twoMembers = [
            filmOn('01/05/2021', [rated('andy', 8), rated('gabe', 6)]),
            filmOn('02/02/2021', [rated('andy', 6), rated('gabe', 7)]),
        ];

        const clickLegend = (options: Highcharts.Options, name: string) => {
            const handler = options.plotOptions!.series!.events!.legendItemClick as unknown as (
                this: Highcharts.Series,
                event: { preventDefault: () => void }
            ) => void;
            const preventDefault = jest.fn();
            act(() => handler.call({ name } as Highcharts.Series, { preventDefault }));
            return preventDefault;
        };

        const visibility = (options: Highcharts.Options) =>
            (options.series as Highcharts.SeriesLineOptions[]).map((series) => series.visible);

        it('shows everyone to start with', () => {
            const { result } = renderHook(() => useMemberTrendsChart(twoMembers, [andy, gabe]));
            expect(visibility(result.current.chartOptions)).toEqual([true, true]);
        });

        it('singles out the clicked name in place of Highcharts’ own toggle', () => {
            const { result } = renderHook(() => useMemberTrendsChart(twoMembers, [andy, gabe]));
            const preventDefault = clickLegend(result.current.chartOptions, 'Gabe');
            expect(preventDefault).toHaveBeenCalled();
            expect(visibility(result.current.chartOptions)).toEqual([false, true]);
            clickLegend(result.current.chartOptions, 'Gabe');
            expect(visibility(result.current.chartOptions)).toEqual([true, true]);
        });

        it('closes an open point whose line is hidden', () => {
            const { result } = renderHook(() => useMemberTrendsChart(twoMembers, [andy, gabe]));
            clickPoint(result.current.chartOptions, 'Andy', 0);
            expect(result.current.selectedPoint).not.toBeNull();
            clickLegend(result.current.chartOptions, 'Gabe');
            expect(result.current.selectedPoint).toBeNull();
        });

        it('keeps an open point whose line stays shown', () => {
            const { result } = renderHook(() => useMemberTrendsChart(twoMembers, [andy, gabe]));
            clickPoint(result.current.chartOptions, 'Andy', 0);
            clickLegend(result.current.chartOptions, 'Andy');
            expect(result.current.selectedPoint?.trend.name).toBe('Andy');
        });
    });
});
