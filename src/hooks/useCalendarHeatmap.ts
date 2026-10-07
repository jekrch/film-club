import { useCallback, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
// Registers the heatmap series type on the Highcharts import above.
import 'highcharts/modules/heatmap';
import { Film } from '../types/film';
import { prefersReducedMotion } from '../utils/motion';
import {
    MonthFilms,
    SHORT_MONTH_NAMES,
    formatLongMonth,
    monthKey,
    monthlyFilms,
} from '../utils/timelineUtils';
import {
    SANS,
    SERIF,
    SLATE_100,
    SLATE_500,
    PAGE_BG,
    COPPER,
    COPPER_DIM,
    COPPER_BRIGHT,
    SMALL_CAPS,
    FIGURES,
    TOOLTIP_CARD,
    tooltipCard,
    unit,
} from '../utils/chartTheme';
import { MAX_SCORE } from '../utils/ratingEditUtils';

/** What a cell's shade stands for. */
export type CalendarShade = 'films' | 'score';

export const CALENDAR_SHADE_LABELS: Record<CalendarShade, string> = {
    films: 'Films',
    score: 'Score',
};

/** A month with nothing in it: slate-800, a step up from the card it sits on. */
const EMPTY_CELL = '#1e293b';
/** From a dim, barely warm cell to bright copper. */
const RAMP: [number, string][] = [
    [0, COPPER_DIM],
    [1, COPPER_BRIGHT],
];

export interface CalendarCell {
    /** `2021-03`. */
    key: string;
    year: number;
    /** 0 for January. */
    monthIndex: number;
    /** Null for a month the club watched nothing in. */
    month: MonthFilms | null;
}

/**
 * Every month from the club's first watched film to its last, a cell each,
 * with the years they span. Empty months are cells too: a gap in the calendar
 * is the point of drawing one.
 */
export const calendarCells = (films: Film[]): { years: number[]; cells: CalendarCell[] } => {
    const months = monthlyFilms(films);
    if (!months.length) return { years: [], cells: [] };

    const byKey = new Map(months.map((month) => [month.key, month]));
    const first = months[0].month;
    const last = months[months.length - 1].month;
    const cells: CalendarCell[] = [];
    for (
        let date = first;
        date.getTime() <= last.getTime();
        date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    ) {
        const key = monthKey(date);
        cells.push({
            key,
            year: date.getUTCFullYear(),
            monthIndex: date.getUTCMonth(),
            month: byKey.get(key) ?? null,
        });
    }
    const years = Array.from(
        { length: last.getUTCFullYear() - first.getUTCFullYear() + 1 },
        (_, i) => first.getUTCFullYear() + i
    );
    return { years, cells };
};

/** A cell's value under a shade: its film count, or its average (null if unscored). */
const cellValue = (cell: CalendarCell, shade: CalendarShade): number | null =>
    shade === 'films' ? (cell.month?.films.length ?? 0) : (cell.month?.average ?? null);

const filmsUnit = (count: number): string => `film${count === 1 ? '' : 's'}`;

export interface UseCalendarHeatmapReturn {
    years: number[];
    cells: CalendarCell[];
    shade: CalendarShade;
    setShade: (shade: CalendarShade) => void;
    chartOptions: Highcharts.Options;
    selectedMonth: MonthFilms | null;
    closeCalendarDetail: () => void;
}

export const useCalendarHeatmap = (films: Film[]): UseCalendarHeatmapReturn => {
    const { years, cells } = useMemo(() => calendarCells(films), [films]);
    const [shade, setShade] = useState<CalendarShade>('films');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const selectedMonth = useMemo(
        () => cells.find((cell) => cell.key === selectedKey)?.month ?? null,
        [cells, selectedKey]
    );

    // An empty month has nothing to open; a second click on the open one closes it.
    const handleCellClick = useCallback((cell: CalendarCell) => {
        if (!cell.month) return;
        setSelectedKey((current) => (current === cell.key ? null : cell.key));
    }, []);

    const closeCalendarDetail = useCallback(() => setSelectedKey(null), []);

    const chartOptions = useMemo((): Highcharts.Options => {
        const values = cells
            .map((cell) => cellValue(cell, shade))
            .filter((value): value is number => value !== null);
        // Films from none up; scores across the club's own range rather than
        // the whole 0–9, where every month would be the same middling copper.
        const scored = shade === 'score' && values.length > 0;
        const colorMin = scored ? Math.floor(Math.min(...values)) : 0;
        const colorMax =
            shade === 'films'
                ? Math.max(...values, 1)
                : scored
                  ? Math.ceil(Math.max(...values))
                  : MAX_SCORE;
        // An empty month stays the empty color; one film is where the copper starts.
        const stops: [number, string][] =
            shade === 'films' ? [[0, EMPTY_CELL], [1 / colorMax, RAMP[0][1]], RAMP[1]] : RAMP;

        return {
            chart: {
                type: 'heatmap',
                backgroundColor: '',
                style: { fontFamily: SANS },
                // A row per year, tall enough to hold a figure.
                height: years.length * 38 + 110,
                events: {
                    // Cells paint in order, so a later neighbour's border would
                    // cover half the open cell's outline; lift it above them.
                    render: function () {
                        const index = cells.findIndex((cell) => cell.key === selectedKey);
                        if (index >= 0) this.series[0]?.points[index]?.graphic?.toFront();
                    },
                },
            },
            // Set in the page as a serif section head; see donutChartOptions.
            title: { text: undefined },
            xAxis: {
                categories: SHORT_MONTH_NAMES,
                labels: { style: SMALL_CAPS },
                lineWidth: 0,
                tickLength: 0,
            },
            yAxis: {
                categories: years.map(String),
                // Oldest year on top, reading down like a calendar.
                reversed: true,
                title: { text: null },
                labels: { style: FIGURES },
                gridLineWidth: 0,
            },
            colorAxis: {
                min: colorMin,
                max: colorMax,
                stops,
                ...(shade === 'films' ? { tickInterval: 1 } : {}),
                labels: { style: FIGURES },
            },
            legend: {
                enabled: true,
                title: {
                    text: shade === 'films' ? 'Films watched' : 'Average club score',
                    style: { ...SMALL_CAPS, color: SLATE_500 },
                },
                symbolWidth: 220,
                symbolHeight: 8,
            },
            tooltip: {
                ...TOOLTIP_CARD,
                formatter: function () {
                    const cell = cells[this.index];
                    if (!cell) return false;
                    const count = cell.month?.films.length ?? 0;
                    const average = cell.month?.average ?? null;
                    const label = formatLongMonth(new Date(Date.UTC(cell.year, cell.monthIndex)));
                    const figure =
                        shade === 'score' && average !== null
                            ? average.toFixed(1) + unit(`avg · ${count} ${filmsUnit(count)}`)
                            : `${count}` +
                              unit(
                                  filmsUnit(count) +
                                      (average !== null ? ` · ${average.toFixed(1)} avg` : '')
                              );
                    return tooltipCard(
                        label,
                        figure,
                        COPPER,
                        cell.month?.films.map((entry) => entry.film.title).join(' · ')
                    );
                },
            },
            plotOptions: {
                heatmap: {
                    borderColor: PAGE_BG,
                    borderWidth: 2,
                    borderRadius: 3,
                    // The outline straddles the cell's edge; unclipped, so an
                    // edge cell's shows in full.
                    clip: false,
                    nullColor: EMPTY_CELL,
                    dataLabels: {
                        enabled: true,
                        formatter: function () {
                            // A heatmap point carries `value`, which the base Point type lacks.
                            const { value } = this as Highcharts.Point & { value?: number | null };
                            if (value === null || value === undefined || value === 0) return '';
                            return shade === 'films' ? String(value) : value.toFixed(1);
                        },
                        style: {
                            fontFamily: SERIF,
                            fontSize: '10px',
                            fontWeight: 'normal',
                            textOutline: 'none',
                        },
                        // Dark on the bright cells, light on the dim ones.
                        color: 'contrast',
                    },
                },
                series: {
                    animation: !prefersReducedMotion(),
                    cursor: 'pointer',
                    point: {
                        events: {
                            click: function () {
                                const cell = cells[this.index];
                                if (cell) handleCellClick(cell);
                            },
                        },
                    },
                },
            },
            series: [
                {
                    name: 'Calendar',
                    type: 'heatmap',
                    // Every cell's border spelled out, not left to the series: an
                    // update merges into the old point, so a cell told only
                    // `undefined` would keep its outline.
                    data: cells.map((cell) => {
                        const open = cell.key === selectedKey;
                        return {
                            x: cell.monthIndex,
                            y: cell.year - years[0],
                            value: cellValue(cell, shade),
                            borderColor: open ? SLATE_100 : PAGE_BG,
                            borderWidth: 2,
                        };
                    }),
                },
            ],
            credits: { enabled: false },
        };
    }, [cells, years, shade, selectedKey, handleCellClick]);

    return {
        years,
        cells,
        shade,
        setShade,
        chartOptions,
        selectedMonth,
        closeCalendarDetail,
    };
};
