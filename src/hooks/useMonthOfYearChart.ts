import { useCallback, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import { Film } from '../types/film';
import { prefersReducedMotion } from '../utils/motion';
import {
    DatedFilm,
    LONG_MONTH_NAMES,
    SHORT_MONTH_NAMES,
    datedFilms,
    mean,
    roundToTenth,
} from '../utils/timelineUtils';
import {
    SANS,
    SLATE_100,
    SLATE_300,
    SLATE_400,
    SLATE_500,
    PAGE_BG,
    RULE,
    COPPER,
    SMALL_CAPS,
    FIGURES,
    TOOLTIP_CARD,
    tooltipCard,
    unit,
    copperShade,
} from '../utils/chartTheme';
import { MAX_SCORE } from '../utils/ratingEditUtils';

/**
 * Each month's column color: copper as bright as its average is high, measured
 * across the whole numbers the months' averages span (as the calendar's score
 * shading is) rather than across 0–9, where every month would be about the
 * same copper.
 */
export const monthShades = (months: MonthOfYear[]): (string | null)[] => {
    const averages = months.flatMap((month) => (month.average === null ? [] : [month.average]));
    const low = Math.floor(Math.min(...averages));
    const high = Math.ceil(Math.max(...averages));
    return months.map((month) =>
        month.average === null
            ? null
            : copperShade(high === low ? 1 : (month.average - low) / (high - low))
    );
};

/** A watched film the club has scored. */
export type ScoredFilm = DatedFilm & { score: number };

/** One month of the calendar, gathered across every year the club has met. */
export interface MonthOfYear {
    /** 0 for January. */
    monthIndex: number;
    /** The mean of the films' club averages, to one decimal; null if none were scored. */
    average: number | null;
    /** Every scored film watched in this month of any year, oldest first. */
    films: ScoredFilm[];
    /** The years those films were watched in, oldest first. */
    years: number[];
}

/**
 * The club's scored films gathered by the month of the year they were watched
 * in — every January together, whatever the year — twelve entries, January
 * first. Each film counts once however many members scored it, so a month reads
 * as "how good were the films" rather than "how generous was whoever showed up".
 */
export const monthOfYearScores = (films: Film[]): MonthOfYear[] => {
    const scored = datedFilms(films).filter((entry): entry is ScoredFilm => entry.score !== null);
    return Array.from({ length: 12 }, (_, monthIndex) => {
        const inMonth = scored.filter((entry) => entry.watchDate.getUTCMonth() === monthIndex);
        return {
            monthIndex,
            average: inMonth.length
                ? roundToTenth(mean(inMonth.map((entry) => entry.score)))
                : null,
            films: inMonth,
            years: Array.from(new Set(inMonth.map((entry) => entry.watchDate.getUTCFullYear()))),
        };
    });
};

export interface UseMonthOfYearChartReturn {
    months: MonthOfYear[];
    /** How many scored films the chart covers. */
    filmCount: number;
    /** The mean score across every scored film, drawn as a rule across the columns. */
    overallAverage: number | null;
    chartOptions: Highcharts.Options;
    selectedMonth: MonthOfYear | null;
    closeMonthDetail: () => void;
}

export const useMonthOfYearChart = (films: Film[]): UseMonthOfYearChartReturn => {
    const months = useMemo(() => monthOfYearScores(films), [films]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const selectedMonth = selectedIndex === null ? null : months[selectedIndex];

    const scores = useMemo(
        () => months.flatMap((month) => month.films.map((entry) => entry.score)),
        [months]
    );
    const overallAverage = scores.length ? roundToTenth(mean(scores)) : null;

    // A month with no films has nothing to open; a second click on the open one closes it.
    const handleMonthClick = useCallback(
        (monthIndex: number) => {
            if (!months[monthIndex]?.films.length) return;
            setSelectedIndex((current) => (current === monthIndex ? null : monthIndex));
        },
        [months]
    );

    const closeMonthDetail = useCallback(() => setSelectedIndex(null), []);

    const shades = useMemo(() => monthShades(months), [months]);

    const chartOptions = useMemo(
        (): Highcharts.Options => ({
            chart: {
                type: 'column',
                backgroundColor: '',
                style: { fontFamily: SANS },
                // Each axis keeps its own ticks: aligned to the films axis's
                // count, the score axis would stretch past 9 to match.
                alignTicks: false,
            },
            // Set in the page as a serif section head; see donutChartOptions.
            title: { text: undefined },
            xAxis: {
                categories: SHORT_MONTH_NAMES,
                labels: { style: SMALL_CAPS },
                lineColor: RULE,
                tickColor: RULE,
            },
            yAxis: [
                {
                    // The whole scale, so a month's column is as tall as its score
                    // is high rather than as tall as it is above the worst month.
                    min: 0,
                    max: MAX_SCORE,
                    tickInterval: 3,
                    title: {
                        text: 'Average Club Score',
                        style: { ...SMALL_CAPS, color: SLATE_500 },
                    },
                    labels: { style: FIGURES },
                    gridLineColor: RULE,
                    gridLineDashStyle: 'Dot',
                    plotLines:
                        overallAverage === null
                            ? []
                            : [
                                  {
                                      value: overallAverage,
                                      color: SLATE_400,
                                      width: 1,
                                      dashStyle: 'Dash',
                                      zIndex: 4,
                                      label: {
                                          text: `Club avg ${overallAverage.toFixed(1)}`,
                                          align: 'right',
                                          x: -4,
                                          y: -6,
                                          style: { ...SMALL_CAPS, color: SLATE_400 },
                                      },
                                  },
                              ],
                },
                {
                    // The films-watched line's own scale, on the right.
                    min: 0,
                    allowDecimals: false,
                    opposite: true,
                    title: {
                        text: 'Films Watched',
                        style: { ...SMALL_CAPS, color: SLATE_500 },
                    },
                    labels: { style: FIGURES },
                    gridLineWidth: 0,
                },
            ],
            legend: {
                enabled: true,
                itemStyle: { ...SMALL_CAPS, color: SLATE_400 },
                itemHoverStyle: { color: SLATE_100 },
            },
            tooltip: {
                ...TOOLTIP_CARD,
                formatter: function () {
                    // The same card from the column or the line: both are the month.
                    const month = months[this.index];
                    if (!month || month.average === null) return false;
                    const count = month.films.length;
                    return tooltipCard(
                        `${LONG_MONTH_NAMES[month.monthIndex]} · all years`,
                        month.average.toFixed(1) +
                            unit(`avg · ${count} film${count === 1 ? '' : 's'}`),
                        shades[month.monthIndex] ?? COPPER,
                        `Watched in ${month.years.join(', ')}`
                    );
                },
            },
            plotOptions: {
                column: {
                    borderColor: PAGE_BG,
                    borderWidth: 1,
                    borderRadius: 2,
                    groupPadding: 0.08,
                    pointPadding: 0.04,
                },
                line: {
                    lineWidth: 1.5,
                    // Hollow rings, as on the meeting-gaps line, so the count
                    // reads as a thread over the columns rather than more bars.
                    marker: {
                        enabled: true,
                        radius: 3,
                        fillColor: PAGE_BG,
                        lineColor: SLATE_300,
                        lineWidth: 1.5,
                        states: { hover: { radius: 5, fillColor: SLATE_300 } },
                    },
                },
                series: {
                    // The chart remounts on every switch of the timeline chips
                    // to replay this intro, so it honors the reader's setting.
                    animation: !prefersReducedMotion(),
                    cursor: 'pointer',
                    point: {
                        events: {
                            click: function () {
                                handleMonthClick(this.index);
                            },
                        },
                    },
                },
            },
            series: [
                {
                    name: 'Average Score',
                    type: 'column',
                    // The legend's swatch; each column carries its own shade.
                    color: COPPER,
                    // Every point's color and outline spelled out, not left to
                    // the series: an update merges into the old point, so a
                    // column told only `undefined` would keep its outline.
                    data: months.map((month) => {
                        const open = month.monthIndex === selectedIndex;
                        return {
                            y: month.average,
                            color: shades[month.monthIndex] ?? COPPER,
                            borderColor: open ? SLATE_100 : PAGE_BG,
                            borderWidth: open ? 2 : 1,
                        };
                    }),
                },
                {
                    name: 'Films Watched',
                    type: 'line',
                    yAxis: 1,
                    color: SLATE_300,
                    zIndex: 2,
                    data: months.map((month) => month.films.length),
                },
            ],
            credits: { enabled: false },
        }),
        [months, shades, overallAverage, selectedIndex, handleMonthClick]
    );

    return {
        months,
        filmCount: scores.length,
        overallAverage,
        chartOptions,
        selectedMonth,
        closeMonthDetail,
    };
};
