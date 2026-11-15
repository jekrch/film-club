import { useState, useEffect, useMemo, useCallback, useRef, RefObject } from 'react';
import { Film } from '../types/film';
import { prefersReducedMotion } from '../utils/motion';
import {
    CategoryPoint,
    CATEGORIES,
    ChartCategory,
    categoryCounts,
    categoryValuesOf,
    FilmWithDate,
    IntervalDetail,
    isOrdered,
    meetingIntervals,
    sortByWatchDate,
} from '../utils/almanacUtils';
import Highcharts from 'highcharts';
import {
    SANS,
    SERIF,
    SLATE_300,
    SLATE_500,
    SLATE_600,
    PAGE_BG,
    RULE,
    COPPER,
    SMALL_CAPS,
    FIGURES,
    TOOLTIP_CARD,
    tooltipCard,
    unit,
} from '../utils/chartTheme';

// The figures live in `almanacUtils` so the retrospective reads the same ones;
// these re-exports keep the almanac's own imports where they were.
export { CATEGORY_LABELS } from '../utils/almanacUtils';
export type { ChartCategory, IntervalDetail } from '../utils/almanacUtils';

/**
 * On narrow screens the donut becomes a bar chart, one bar per category, and a
 * club that has watched films from thirty countries gets a chart thirty bars
 * tall. Past this many bars, the smallest are folded into one "Other" bar.
 * Ordered categories are exempt: they have only a handful of values, and they
 * read in order.
 */
const MOBILE_BAR_LIMIT = 10;
const OTHER_LABEL = 'Other';

export interface UseAlmanacChartsReturn {
    // Donut Chart
    selectedCategory: ChartCategory;
    /** Switches the chart, closing any film list opened from the old one. */
    setSelectedCategory: (category: ChartCategory) => void;
    currentDonutChartData: CategoryPoint[];
    currentDonutChartTitle: string;
    donutChartOptions: Highcharts.Options;
    selectedPieSliceName: string | null;
    filteredFilmsForPieSlice: Film[];
    handleCategoryClick: (point: Highcharts.Point) => void; // Expose handler
    closeFilteredList: () => void;
    filteredListTitle: string;
    filmListRef: RefObject<HTMLDivElement | null>;

    // Interval Chart
    meetingIntervalData: Highcharts.PointOptionsObject[];
    meetingIntervalCategories: string[];
    meetingIntervalChartOptions: Highcharts.Options;
    selectedIntervalDetail: IntervalDetail | null;
    handleIntervalClick: (event: Highcharts.PointClickEventObject) => void; // Expose handler
    closeIntervalDetail: () => void;

    // General
    watchedFilmsSorted: FilmWithDate[]; // Expose for interval chart film details
}

export const useAlmanacCharts = (filmsInput: Film[]): UseAlmanacChartsReturn => {
    const [allFilmsDataState, setAllFilmsDataState] = useState<Film[]>(filmsInput);
    const [watchedFilmsSorted, setWatchedFilmsSorted] = useState<FilmWithDate[]>([]);

    // Donut Chart State
    const [selectedCategory, setSelectedCategoryState] = useState<ChartCategory>('country');
    const [chartDataByCategory, setChartDataByCategory] = useState<
        Partial<Record<ChartCategory, CategoryPoint[]>>
    >({});
    const [selectedPieSliceName, setSelectedPieSliceName] = useState<string | null>(null);
    const [filteredFilmsForPieSlice, setFilteredFilmsForPieSlice] = useState<Film[]>([]);
    const filmListRef = useRef<HTMLDivElement>(null);

    // Interval Chart State
    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>(
        []
    );
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(
        null
    );

    useEffect(() => {
        setAllFilmsDataState(filmsInput); // Update if input changes
    }, [filmsInput]);

    useEffect(() => {
        const finalSortedWatched = sortByWatchDate(allFilmsDataState);
        setWatchedFilmsSorted(finalSortedWatched);

        // Process Donut Chart Data: count each category's values, then sort
        // ordered categories in their order and the rest largest first.
        const dataByCategory: Partial<Record<ChartCategory, CategoryPoint[]>> = {};
        CATEGORIES.forEach((category) => {
            dataByCategory[category] = categoryCounts(allFilmsDataState, category);
        });
        setChartDataByCategory(dataByCategory);

        // Process Interval Chart Data
        const gaps = meetingIntervals(finalSortedWatched);
        const intervalCategories = gaps.map((gap) =>
            gap.endDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: '2-digit',
            })
        );
        const intervals: Highcharts.PointOptionsObject[] = gaps.map(
            (gap) =>
                ({
                    y: gap.days,
                    intervalIndex: gap.index,
                    startDate: gap.startDate.getTime(),
                    endDate: gap.endDate.getTime(),
                    category: gap.film.title, // For tooltip
                }) as any // Cast to any to satisfy Highcharts specific point options
        );
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);
    }, [allFilmsDataState]);

    const currentDonutChartData = useMemo(
        () => chartDataByCategory[selectedCategory] ?? [],
        [selectedCategory, chartDataByCategory]
    );

    // The bars the narrow-screen chart draws, and the categories its "Other"
    // bar stands for.
    const { mobileBarData, otherNames } = useMemo(() => {
        if (isOrdered(selectedCategory) || currentDonutChartData.length <= MOBILE_BAR_LIMIT) {
            return { mobileBarData: currentDonutChartData, otherNames: new Set<string>() };
        }
        // Already sorted by count, largest first.
        const kept = currentDonutChartData.slice(0, MOBILE_BAR_LIMIT - 1);
        const rest = new Set(currentDonutChartData.slice(MOBILE_BAR_LIMIT - 1).map((d) => d.name));
        // Counted in films rather than summed from the folded bars, which for
        // genre would count a film once for each folded genre it has.
        const counted = allFilmsDataState
            .map((film) => categoryValuesOf(film, selectedCategory))
            .filter((values) => values.length);
        const inOther = counted.filter((values) => values.some((v) => rest.has(v))).length;
        return {
            mobileBarData: [
                ...kept,
                {
                    name: OTHER_LABEL,
                    y: inOther,
                    share: (inOther / counted.length) * 100,
                    color: SLATE_500,
                },
            ],
            otherNames: rest,
        };
    }, [selectedCategory, currentDonutChartData, allFilmsDataState]);

    const currentDonutChartTitle = useMemo(() => {
        switch (selectedCategory) {
            case 'language':
                return 'Films by Primary Language';
            case 'decade':
                return 'Films by Decade of Release';
            case 'runtime':
                return 'Films by Runtime';
            case 'genre':
                return 'Films by Genre';
            case 'country':
            default:
                return 'Films by Country of Origin';
        }
    }, [selectedCategory]);

    const handleCategoryClick = useCallback(
        (point: Highcharts.Point) => {
            const sliceName = point.name;
            if (sliceName === selectedPieSliceName) {
                setSelectedPieSliceName(null);
                setFilteredFilmsForPieSlice([]);
                return;
            }

            // "Other" exists only on the narrow-screen bar chart, and stands
            // for every category folded into it.
            const matches = (value: string) =>
                sliceName === OTHER_LABEL && otherNames.size > 0
                    ? otherNames.has(value)
                    : value === sliceName;
            const filtered = allFilmsDataState.filter((film) =>
                categoryValuesOf(film, selectedCategory).some(matches)
            );
            setSelectedPieSliceName(sliceName);
            setFilteredFilmsForPieSlice(filtered);
        },
        [selectedCategory, allFilmsDataState, selectedPieSliceName, otherNames]
    );

    // A slice of one category means nothing on another's chart, so its list
    // goes when the chart changes. Picking the chart already showing keeps it.
    const setSelectedCategory = useCallback(
        (category: ChartCategory) => {
            if (category === selectedCategory) return;
            setSelectedCategoryState(category);
            setSelectedPieSliceName(null);
            setFilteredFilmsForPieSlice([]);
        },
        [selectedCategory]
    );

    // A frame late, because the list opens in a `Collapse`, which mounts its
    // content a render after it's told to open; by the next frame it's there.
    // Scrolled to at its full height while it's still opening, so the page
    // and the list arrive together.
    useEffect(() => {
        if (!selectedPieSliceName) return;
        const frame = requestAnimationFrame(() =>
            filmListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        );
        return () => cancelAnimationFrame(frame);
    }, [selectedPieSliceName]);

    const multiValued = selectedCategory === 'genre';

    const donutChartOptions = useMemo((): Highcharts.Options => {
        const pointWidthForCalc = 15;
        const verticalPaddingPerBar = 15;
        const topBottomChartMargin = 80;
        const minChartHeight = 200;
        const numberOfCategories = mobileBarData.length;
        const calculatedHeight = Math.max(
            numberOfCategories * (pointWidthForCalc + verticalPaddingPerBar) + topBottomChartMargin,
            minChartHeight
        );

        return {
            chart: { type: 'pie', backgroundColor: '', style: { fontFamily: SANS } },
            // The title is set in the page, as a serif section head above the
            // category chips, rather than drawn by Highcharts.
            title: { text: undefined },
            tooltip: {
                ...TOOLTIP_CARD,
                formatter: function () {
                    const count = this.y ?? 0;
                    const share = (this.options as CategoryPoint).share;
                    return tooltipCard(
                        this.name ?? '',
                        multiValued
                            ? `${count}` +
                                  unit(
                                      `film${count === 1 ? '' : 's'} · ${share.toFixed(0)}% of all`
                                  )
                            : `${share.toFixed(1)}%` +
                                  unit(`${count} film${count === 1 ? '' : 's'}`),
                        String(this.color ?? COPPER)
                    );
                },
            },
            accessibility: { point: { valueSuffix: '%' } },
            plotOptions: {
                // The chart remounts on every category switch to replay this
                // intro (see AlmanacPage), so it honors the reader's setting.
                series: { animation: !prefersReducedMotion() },
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    borderColor: PAGE_BG,
                    borderWidth: 2,
                    innerSize: '60%',
                    size: '90%',
                    dataLabels: {
                        enabled: true,
                        // Small-caps name, serif figure: the stat cards' pairing.
                        // A count for genre, whose slices are sized by genre
                        // rather than by film; a share of films there would
                        // overstate the slice it labels.
                        format: `{point.name} <span style="font-family:${SERIF};font-size:11px;letter-spacing:0;text-transform:none;color:${SLATE_300}">${multiValued ? '{point.y}' : '{point.percentage:.1f}%'}</span>`,
                        distance: 20,
                        style: {
                            ...SMALL_CAPS,
                            textOutline: 'none',
                            cursor: 'pointer',
                        },
                        connectorColor: SLATE_600,
                        filter: { property: 'percentage', operator: '>', value: 3 },
                        events: {
                            click: function () {
                                handleCategoryClick(this.point);
                            },
                        } as any,
                    } as any,
                    showInLegend: false,
                    point: {
                        events: {
                            click: function () {
                                handleCategoryClick(this);
                            },
                        },
                    },
                },
            },
            series: [{ name: 'Films', type: 'pie', data: currentDonutChartData as any[] }],
            credits: { enabled: false },
            colors: [
                COPPER,
                '#d9a534',
                '#1a7b6d',
                '#be5a38',
                '#6b7da3',
                '#a34a6a',
                '#2c815c',
                '#c88b3a',
                '#734f8c',
                '#b35450',
                '#a87c5f',
                '#d3a064',
                '#5f7464',
                '#946b54',
                '#7c6a53',
                '#85594c',
                '#4e6e81',
                '#8f4e5b',
                '#5c6e58',
                '#8d7471',
            ],
            responsive: {
                rules: [
                    {
                        condition: { maxWidth: 640 },
                        chartOptions: {
                            chart: { type: 'bar', height: calculatedHeight },
                            xAxis: {
                                categories: mobileBarData.map((d) => d.name || ''),
                                title: { text: undefined },
                                labels: { style: SMALL_CAPS },
                                lineColor: RULE,
                                tickColor: RULE,
                            },
                            yAxis: {
                                title: {
                                    text: 'Number of Films',
                                    style: { ...SMALL_CAPS, color: SLATE_500 },
                                },
                                labels: { style: FIGURES },
                                gridLineColor: RULE,
                                gridLineDashStyle: 'Dot',
                            },
                            plotOptions: {
                                pie: {
                                    dataLabels: { enabled: false },
                                } as Highcharts.PlotPieOptions,
                                bar: {
                                    borderColor: PAGE_BG,
                                    borderRadius: 2,
                                    dataLabels: {
                                        enabled: true,
                                        align: 'right',
                                        color: SLATE_300,
                                        style: {
                                            ...FIGURES,
                                            color: SLATE_300,
                                            textOutline: 'none',
                                            fontWeight: 'normal',
                                            cursor: 'pointer',
                                        },
                                        format: '{point.y}',
                                        inside: false,
                                        events: {
                                            click: function () {
                                                handleCategoryClick(this.point);
                                            },
                                        } as any,
                                    },
                                    showInLegend: false,
                                    pointWidth: pointWidthForCalc,
                                    point: {
                                        events: {
                                            click: function () {
                                                handleCategoryClick(this);
                                            },
                                        },
                                    },
                                } as Highcharts.PlotBarOptions,
                            },
                            tooltip: {
                                formatter: function () {
                                    const count = this.y ?? 0;
                                    const share = (this.options as CategoryPoint).share;
                                    return tooltipCard(
                                        this.name ?? String(this.category ?? ''),
                                        `${count}` +
                                            unit(
                                                `film${count === 1 ? '' : 's'} · ` +
                                                    (multiValued
                                                        ? `${share.toFixed(0)}% of all`
                                                        : `${share.toFixed(1)}%`)
                                            ),
                                        String(this.color ?? COPPER)
                                    );
                                },
                            },
                            series: [
                                {
                                    name: 'Films',
                                    type: 'bar',
                                    data: mobileBarData as any[],
                                },
                            ],
                        },
                    },
                ],
            },
        };
    }, [currentDonutChartData, mobileBarData, handleCategoryClick, multiValued]);

    const handleIntervalClick = useCallback(
        (event: Highcharts.PointClickEventObject) => {
            const point = event.point as any;
            const intervalIndex = point.intervalIndex;
            if (
                typeof intervalIndex === 'number' &&
                intervalIndex >= 1 &&
                intervalIndex < watchedFilmsSorted.length
            ) {
                setSelectedIntervalDetail({
                    startDate: new Date(point.startDate),
                    endDate: new Date(point.endDate),
                    days: point.y,
                    films: watchedFilmsSorted.slice(intervalIndex, intervalIndex + 1), // Film at the END of the interval
                });
            } else {
                setSelectedIntervalDetail(null);
            }
        },
        [watchedFilmsSorted]
    );

    const meetingIntervalChartOptions = useMemo(
        (): Highcharts.Options => ({
            chart: {
                type: 'line',
                backgroundColor: '',
                style: { fontFamily: SANS },
            },
            // Set in the page as a serif section head; see donutChartOptions.
            title: { text: undefined },
            xAxis: {
                categories: meetingIntervalCategories,
                labels: { rotation: -45, style: SMALL_CAPS },
                lineColor: RULE,
                tickColor: RULE,
            },
            yAxis: {
                min: 0,
                title: {
                    text: 'Days Since Last Meeting',
                    style: { ...SMALL_CAPS, color: SLATE_500 },
                },
                labels: { style: FIGURES },
                gridLineColor: RULE,
                gridLineDashStyle: 'Dot',
            },
            legend: { enabled: false },
            tooltip: {
                ...TOOLTIP_CARD,
                // `this` is the hovered point; the film's title rides along in
                // its options as `category` (see the interval data above).
                formatter: function () {
                    const days = this.y ?? 0;
                    const film = (this.options as { category?: string }).category;
                    return tooltipCard(
                        `Ended ${this.category ?? ''}`,
                        `${days}` + unit(days === 1 ? 'day' : 'days'),
                        COPPER,
                        film
                    );
                },
            },
            plotOptions: {
                line: {
                    lineWidth: 1.5,
                    // Hollow rings in the page color, so the line reads as a
                    // thread through the dates rather than a row of dots.
                    marker: {
                        enabled: true,
                        radius: 3,
                        fillColor: PAGE_BG,
                        lineColor: COPPER,
                        lineWidth: 1.5,
                        states: { hover: { radius: 5, fillColor: COPPER } },
                    },
                    states: { hover: { lineWidth: 2 } },
                },
                series: {
                    // Remounted on every switch of the timeline chips, like the
                    // donut; see donutChartOptions.
                    animation: !prefersReducedMotion(),
                    cursor: 'pointer',
                    point: { events: { click: handleIntervalClick } },
                },
            },
            series: [
                {
                    name: 'Days Between Meetings',
                    type: 'line',
                    color: COPPER,
                    data: meetingIntervalData as any[],
                },
            ],
            credits: { enabled: false },
        }),
        [meetingIntervalData, meetingIntervalCategories, handleIntervalClick]
    );

    const closeFilteredList = useCallback(() => {
        setSelectedPieSliceName(null);
        setFilteredFilmsForPieSlice([]);
    }, []);

    const closeIntervalDetail = useCallback(() => {
        setSelectedIntervalDetail(null);
    }, []);

    const filteredListTitle = useMemo(() => {
        if (!selectedPieSliceName) return '';
        if (selectedPieSliceName === OTHER_LABEL && otherNames.size > 0) {
            switch (selectedCategory) {
                case 'language':
                    return 'Films in Other Languages';
                case 'genre':
                    return 'Films in Other Genres';
                default:
                    return 'Films from Other Countries';
            }
        }
        switch (selectedCategory) {
            case 'country':
                return `Films from ${selectedPieSliceName}`;
            case 'language':
                return `Films in ${selectedPieSliceName}`;
            case 'decade':
                return `Films Released in the ${selectedPieSliceName}`;
            case 'runtime':
                return `Films Running ${selectedPieSliceName}`;
            case 'genre':
                return `${selectedPieSliceName} Films`;
            default:
                return 'Selected Films';
        }
    }, [selectedCategory, selectedPieSliceName, otherNames]);

    return {
        selectedCategory,
        setSelectedCategory,
        currentDonutChartData,
        currentDonutChartTitle,
        donutChartOptions,
        selectedPieSliceName,
        filteredFilmsForPieSlice,
        handleCategoryClick,
        closeFilteredList,
        filteredListTitle,
        filmListRef,
        meetingIntervalData,
        meetingIntervalCategories,
        meetingIntervalChartOptions,
        selectedIntervalDetail,
        handleIntervalClick,
        closeIntervalDetail,
        watchedFilmsSorted,
    };
};
