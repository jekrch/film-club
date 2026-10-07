import { useCallback, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import { Film } from '../types/film';
import { TeamMember } from '../types/team';
import { prefersReducedMotion } from '../utils/motion';
import {
    DatedFilm,
    datedFilms,
    formatLongMonth,
    mean,
    monthKey,
    roundToTenth,
} from '../utils/timelineUtils';
import {
    SANS,
    SLATE_100,
    SLATE_300,
    SLATE_500,
    SLATE_600,
    PAGE_BG,
    RULE,
    SMALL_CAPS,
    FIGURES,
    TOOLTIP_CARD,
    tooltipCard,
    unit,
    memberChartColor,
} from '../utils/chartTheme';
import { MAX_SCORE } from '../utils/ratingEditUtils';

/** A member's film score, in place of the club's average in `DatedFilm`. */
export type MemberScoredFilm = DatedFilm & { score: number };

/** One member's scores for the films watched in one month. */
export interface MemberMonth {
    /** `2021-03`. */
    key: string;
    /** The first of the month, UTC. */
    month: Date;
    /** The member's mean score for the month's films, to one decimal. */
    average: number;
    /** The films they scored that month, oldest first, with their scores. */
    films: MemberScoredFilm[];
}

export interface MemberTrend {
    name: string;
    color: string;
    /** Only the months they scored something in, oldest first. */
    months: MemberMonth[];
}

/**
 * Each member's average score month by month, over the films they scored.
 * Members who haven't scored anything are left out.
 */
export const memberMonthlyScores = (films: Film[], members: TeamMember[]): MemberTrend[] => {
    const dated = datedFilms(films);
    let fallbacks = 0;

    return members.flatMap((member) => {
        const name = member.name.toLowerCase();
        const byMonth = new Map<string, MemberScoredFilm[]>();
        dated.forEach((entry) => {
            const rating = entry.film.movieClubInfo?.clubRatings.find(
                (r) => r.user?.toLowerCase() === name
            );
            if (typeof rating?.score !== 'number' || isNaN(rating.score)) return;
            const key = monthKey(entry.watchDate);
            byMonth.set(key, [...(byMonth.get(key) ?? []), { ...entry, score: rating.score }]);
        });
        if (!byMonth.size) return [];

        // `dated` is in watch order, so the months come out oldest first.
        const months = Array.from(byMonth.entries()).map(([key, scored]) => {
            const [year, month] = key.split('-').map(Number);
            return {
                key,
                month: new Date(Date.UTC(year, month - 1, 1)),
                average: roundToTenth(mean(scored.map((entry) => entry.score))),
                films: scored,
            };
        });
        const color = memberChartColor(
            member.color,
            member.color ? 0 : fallbacks++ // only uncolored members use one up
        );
        return [{ name: member.name, color, months }];
    });
};

/**
 * The members shown after a click on `name` in the legend, given those shown
 * now. Empty means everyone, and is where the chart starts.
 *
 * From everyone, a name is singled out: the first click asks "just this one".
 * After that a click adds a name or takes it away, and taking away the last one
 * — or adding the last one missing — is back to everyone, so the next click
 * singles a name out again.
 */
export const nextFocusedMembers = (focused: string[], name: string, all: string[]): string[] => {
    if (!focused.length) return [name];
    const next = focused.includes(name)
        ? focused.filter((member) => member !== name)
        : [...focused, name];
    return all.every((member) => next.includes(member)) ? [] : next;
};

const isShown = (focused: string[], name: string): boolean =>
    !focused.length || focused.includes(name);

export interface SelectedMemberMonth {
    trend: MemberTrend;
    month: MemberMonth;
}

export interface UseMemberTrendsChartReturn {
    trends: MemberTrend[];
    /** The members singled out in the legend; empty when everyone is shown. */
    focusedMembers: string[];
    chartOptions: Highcharts.Options;
    selectedPoint: SelectedMemberMonth | null;
    closeTrendDetail: () => void;
}

/** Members left off the trends chart, by lowercase name. */
const EXCLUDED_FROM_TRENDS = ['greg'];

export const useMemberTrendsChart = (
    films: Film[],
    members: TeamMember[]
): UseMemberTrendsChartReturn => {
    const trends = useMemo(
        () =>
            memberMonthlyScores(
                films,
                members.filter(
                    (member) => !EXCLUDED_FROM_TRENDS.includes(member.name.toLowerCase())
                )
            ),
        [films, members]
    );
    const [selected, setSelected] = useState<{ member: string; key: string } | null>(null);
    const [focusedMembers, setFocusedMembers] = useState<string[]>([]);

    const selectedPoint = useMemo(() => {
        if (!selected) return null;
        const trend = trends.find((t) => t.name === selected.member);
        const month = trend?.months.find((m) => m.key === selected.key);
        return trend && month ? { trend, month } : null;
    }, [trends, selected]);

    // A second click on the open point closes it.
    const handlePointClick = useCallback(
        (member: string, key: string) =>
            setSelected((current) =>
                current?.member === member && current.key === key ? null : { member, key }
            ),
        []
    );

    const closeTrendDetail = useCallback(() => setSelected(null), []);

    // An open point whose line is hidden would be a panel about nothing on the
    // chart, so it closes with the line.
    const handleLegendClick = useCallback(
        (name: string) => {
            const next = nextFocusedMembers(
                focusedMembers,
                name,
                trends.map((t) => t.name)
            );
            setFocusedMembers(next);
            setSelected((current) => (current && !isShown(next, current.member) ? null : current));
        },
        [focusedMembers, trends]
    );

    const chartOptions = useMemo(
        (): Highcharts.Options => ({
            chart: { type: 'line', backgroundColor: '', style: { fontFamily: SANS } },
            // Set in the page as a serif section head; see donutChartOptions.
            title: { text: undefined },
            xAxis: {
                type: 'datetime',
                labels: { style: SMALL_CAPS },
                dateTimeLabelFormats: { month: '%b ’%y', year: '%Y' },
                lineColor: RULE,
                tickColor: RULE,
            },
            yAxis: {
                min: 0,
                max: MAX_SCORE,
                tickInterval: 3,
                title: {
                    text: 'Average Score Given',
                    style: { ...SMALL_CAPS, color: SLATE_500 },
                },
                labels: { style: FIGURES },
                gridLineColor: RULE,
                gridLineDashStyle: 'Dot',
            },
            legend: {
                enabled: true,
                itemStyle: { ...SMALL_CAPS, color: SLATE_300 },
                itemHoverStyle: { color: SLATE_100 },
                itemHiddenStyle: { color: SLATE_600 },
            },
            tooltip: {
                ...TOOLTIP_CARD,
                formatter: function () {
                    const trend = trends.find((t) => t.name === this.series.name);
                    const month = trend?.months[this.index];
                    if (!trend || !month) return false;
                    const count = month.films.length;
                    return tooltipCard(
                        `${trend.name} · ${formatLongMonth(month.month)}`,
                        month.average.toFixed(1) +
                            unit(`avg · ${count} film${count === 1 ? '' : 's'}`),
                        trend.color,
                        month.films.map((entry) => entry.film.title).join(' · ')
                    );
                },
            },
            plotOptions: {
                line: {
                    lineWidth: 1.5,
                    // Small dots in each member's color: a month with a single
                    // score between two gaps still shows as a point.
                    marker: {
                        enabled: true,
                        symbol: 'circle',
                        radius: 2.5,
                        lineColor: PAGE_BG,
                        lineWidth: 1,
                        states: { hover: { radius: 5 } },
                    },
                    states: { hover: { lineWidth: 2.5 } },
                },
                series: {
                    // Remounted on every switch of the timeline chips, like the
                    // donut; see donutChartOptions.
                    animation: !prefersReducedMotion(),
                    cursor: 'pointer',
                    events: {
                        // Highcharts' own toggle hides just the clicked line;
                        // visibility is held here instead, so the first click
                        // can single a member out. See `nextFocusedMembers`.
                        legendItemClick: function (event) {
                            event.preventDefault();
                            handleLegendClick(this.name);
                        },
                    },
                    point: {
                        events: {
                            click: function () {
                                const trend = trends.find((t) => t.name === this.series.name);
                                const month = trend?.months[this.index];
                                if (trend && month) handlePointClick(trend.name, month.key);
                            },
                        },
                    },
                },
            },
            series: trends.map(
                (trend): Highcharts.SeriesLineOptions => ({
                    name: trend.name,
                    type: 'line',
                    color: trend.color,
                    visible: isShown(focusedMembers, trend.name),
                    data: trend.months.map((month) => [month.month.getTime(), month.average]),
                })
            ),
            credits: { enabled: false },
        }),
        [trends, focusedMembers, handlePointClick, handleLegendClick]
    );

    return { trends, focusedMembers, chartOptions, selectedPoint, closeTrendDetail };
};
