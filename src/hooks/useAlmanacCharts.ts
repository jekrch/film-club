import { useState, useEffect, useMemo, useCallback, useRef, RefObject } from 'react';
import { Film } from '../types/film';
import { parseWatchDate } from '../utils/filmUtils';
import Highcharts from 'highcharts';

export type ChartCategory = 'country' | 'language' | 'decade';
type FilmWithDate = Film & { parsedWatchDate: Date };

interface IntervalDetail {
    startDate: Date;
    endDate: Date;
    days: number;
    films: FilmWithDate[];
}

// Helper from AlmanacPage (can be local or moved to a date util if more general)
const daysBetween = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
    const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
    return Math.floor(Math.abs(utc2 - utc1) / oneDay);
};

// Chart type, matched to the profile page's: labels in small-caps sans, figures
// in serif. Highcharts draws to SVG and can't see Tailwind, so the slates the
// rest of the page uses are spelled out here.
const SANS = 'Inter, sans-serif';
const SERIF = 'Merriweather, serif';
const SLATE_100 = '#f1f5f9';
const SLATE_300 = '#cbd5e1';
const SLATE_400 = '#94a3b8';
const SLATE_500 = '#64748b';
const SLATE_600 = '#475569';
// The page background (index.css). Slice borders in this color read as gaps.
const PAGE_BG = '#0f172b';
// slate-600 at the opacity the stat cards' rules use.
const RULE = 'rgba(71, 85, 105, 0.4)';
const COPPER = '#b76e41';

const SMALL_CAPS: Highcharts.CSSObject = {
    fontFamily: SANS,
    fontSize: '10px',
    fontWeight: '500',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SLATE_400,
};
const FIGURES: Highcharts.CSSObject = { fontFamily: SERIF, fontSize: '11px', color: SLATE_400 };

const escapeHtml = (text: string): string =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A tooltip set like the stat cards: a small-caps label, the figure in serif,
 * and an optional serif-italic note (a film title).
 *
 * The whole card is drawn here in HTML rather than by Highcharts' SVG box (see
 * TOOLTIP_CARD), so it can have a real shadow, the modal's faint ring, and an
 * accent rail down its left edge — the rail the page's cards carry, here in the
 * hovered slice or line's own color so the tooltip reads as belonging to it.
 */
const tooltipCard = (label: string, figure: string, accent: string, note?: string): string =>
    `<div style="position:relative;overflow:hidden;min-width:120px;padding:10px 14px 10px 16px;border-radius:8px;background:rgba(30,41,59,0.94);box-shadow:0 12px 28px -8px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.07);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)">` +
    `<span style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${accent}"></span>` +
    `<div style="font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:${SLATE_400}">${escapeHtml(label)}</div>` +
    `<div style="margin-top:4px;font-family:${SERIF};font-size:18px;line-height:1.1;color:${SLATE_100}">${figure}</div>` +
    (note
        ? `<div style="margin-top:4px;max-width:220px;white-space:normal;font-family:${SERIF};font-style:italic;font-size:12px;line-height:1.35;color:${SLATE_300}">${escapeHtml(note)}</div>`
        : '') +
    `</div>`;

/** A small-caps word under a serif figure's unit: "34 <FILMS>". */
const unit = (text: string): string =>
    `<span style="margin-left:4px;font-family:${SANS};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${SLATE_400}">${text}</span>`;

/** Highcharts' own box is switched off; `tooltipCard` draws the card. */
const TOOLTIP_CARD: Highcharts.TooltipOptions = {
    useHTML: true,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadow: false,
    padding: 0,
    style: { fontFamily: SANS, color: SLATE_300 },
};

/**
 * On narrow screens the donut becomes a bar chart, one bar per category, and a
 * club that has watched films from thirty countries gets a chart thirty bars
 * tall. Past this many bars, the smallest are folded into one "Other" bar.
 * Decades are exempt: there are only a dozen or so, and they read in order.
 */
const MOBILE_BAR_LIMIT = 10;
const OTHER_LABEL = 'Other';

/** The label a film is counted under in a category: its first country, language, or its decade. */
const categoryValueOf = (film: Film, category: ChartCategory): string | null => {
    switch (category) {
        case 'country':
            return film?.country?.split(',')[0].trim() || null;
        case 'language':
            return film?.language?.split(',')[0].trim() || null;
        case 'decade': {
            const yearNum = parseInt(film.year?.substring(0, 4) || '0', 10);
            return !isNaN(yearNum) && yearNum > 1000 ? `${Math.floor(yearNum / 10) * 10}s` : null;
        }
    }
};

export interface UseAlmanacChartsReturn {
    // Donut Chart
    selectedCategory: ChartCategory;
    setSelectedCategory: React.Dispatch<React.SetStateAction<ChartCategory>>;
    currentDonutChartData: Highcharts.PointOptionsObject[];
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
    const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('country');
    const [countryChartData, setCountryChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [languageChartData, setLanguageChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [decadeChartData, setDecadeChartData] = useState<Highcharts.PointOptionsObject[]>([]);
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
        // Process watched films
        const watchedWithDates = allFilmsDataState
            .map((f) => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) }))
            .filter((f) => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort(
            (a, b) => a.pDate.getTime() - b.pDate.getTime()
        );
        const finalSortedWatched: FilmWithDate[] = sortedWatched.map(({ pDate, ...rest }) => ({
            ...rest,
            parsedWatchDate: pDate,
        }));
        setWatchedFilmsSorted(finalSortedWatched);

        // Process Donut Chart Data
        const countryCounts = new Map<string, number>();
        const languageCounts = new Map<string, number>();
        const decadeCounts = new Map<string, number>();

        allFilmsDataState.forEach((film) => {
            if (film?.country?.trim() && film.country.toLowerCase() !== 'n/a') {
                const primaryCountry = film.country.split(',')[0].trim();
                countryCounts.set(primaryCountry, (countryCounts.get(primaryCountry) || 0) + 1);
            }
            if (film?.language?.trim() && film.language.toLowerCase() !== 'n/a') {
                const primaryLanguage = film.language.split(',')[0].trim();
                languageCounts.set(primaryLanguage, (languageCounts.get(primaryLanguage) || 0) + 1);
            }
            if (film?.year?.substring(0, 4)) {
                const yearNum = parseInt(film.year.substring(0, 4), 10);
                if (!isNaN(yearNum) && yearNum > 1000) {
                    // Basic year validation
                    const decadeLabel = `${Math.floor(yearNum / 10) * 10}s`;
                    decadeCounts.set(decadeLabel, (decadeCounts.get(decadeLabel) || 0) + 1);
                }
            }
        });

        const formatAndSort = (map: Map<string, number>) =>
            Array.from(map.entries())
                .map(([name, y]) => ({ name, y }))
                .sort((a, b) => b.y - a.y);
        setCountryChartData(formatAndSort(countryCounts));
        setLanguageChartData(formatAndSort(languageCounts));
        setDecadeChartData(
            Array.from(decadeCounts.entries())
                .map(([name, y]) => ({ name, y }))
                .sort((a, b) => parseInt(a.name) - parseInt(b.name))
        ); // Sort decades chronologically

        // Process Interval Chart Data
        const intervals: Highcharts.PointOptionsObject[] = [];
        const intervalCategories: string[] = [];
        if (finalSortedWatched.length > 1) {
            for (let i = 1; i < finalSortedWatched.length; i++) {
                const date1 = finalSortedWatched[i - 1].parsedWatchDate;
                const date2 = finalSortedWatched[i].parsedWatchDate;
                const intervalDays = daysBetween(date1, date2);
                const categoryLabel = date2.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit',
                });
                intervalCategories.push(categoryLabel); // Simpler label
                intervals.push({
                    y: intervalDays,
                    intervalIndex: i,
                    startDate: date1.getTime(),
                    endDate: date2.getTime(),
                    category: finalSortedWatched[i].title, // For tooltip
                } as any); // Cast to any to satisfy Highcharts specific point options
            }
        }
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);
    }, [allFilmsDataState]);

    const currentDonutChartData = useMemo(() => {
        switch (selectedCategory) {
            case 'language':
                return languageChartData;
            case 'decade':
                return decadeChartData;
            case 'country':
            default:
                return countryChartData;
        }
    }, [selectedCategory, countryChartData, languageChartData, decadeChartData]);

    // The bars the narrow-screen chart draws, and the categories its "Other"
    // bar stands for.
    const { mobileBarData, otherNames } = useMemo(() => {
        if (selectedCategory === 'decade' || currentDonutChartData.length <= MOBILE_BAR_LIMIT) {
            return { mobileBarData: currentDonutChartData, otherNames: new Set<string>() };
        }
        // Already sorted by count, largest first.
        const kept = currentDonutChartData.slice(0, MOBILE_BAR_LIMIT - 1);
        const rest = currentDonutChartData.slice(MOBILE_BAR_LIMIT - 1);
        return {
            mobileBarData: [
                ...kept,
                {
                    name: OTHER_LABEL,
                    y: rest.reduce((sum, d) => sum + (d.y ?? 0), 0),
                    color: SLATE_500,
                },
            ],
            otherNames: new Set(rest.map((d) => d.name ?? '')),
        };
    }, [selectedCategory, currentDonutChartData]);

    const currentDonutChartTitle = useMemo(() => {
        switch (selectedCategory) {
            case 'language':
                return 'Films by Primary Language';
            case 'decade':
                return 'Films by Decade of Release';
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
            const matches = (value: string | null) =>
                value !== null &&
                (sliceName === OTHER_LABEL && otherNames.size > 0
                    ? otherNames.has(value)
                    : value === sliceName);
            const filtered = allFilmsDataState.filter((film) =>
                matches(categoryValueOf(film, selectedCategory))
            );
            setSelectedPieSliceName(sliceName);
            setFilteredFilmsForPieSlice(filtered);
        },
        [selectedCategory, allFilmsDataState, selectedPieSliceName, otherNames]
    );

    useEffect(() => {
        if (selectedPieSliceName && filmListRef.current) {
            filmListRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedPieSliceName]);

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
                    return tooltipCard(
                        this.name ?? '',
                        `${(this.percentage ?? 0).toFixed(1)}%` +
                            unit(`${count} film${count === 1 ? '' : 's'}`),
                        String(this.color ?? COPPER)
                    );
                },
            },
            accessibility: { point: { valueSuffix: '%' } },
            plotOptions: {
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
                        format: `{point.name} <span style="font-family:${SERIF};font-size:11px;letter-spacing:0;text-transform:none;color:${SLATE_300}">{point.percentage:.1f}%</span>`,
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
                                title: { text: null },
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
                                    const total = currentDonutChartData.reduce(
                                        (sum, d) => sum + (d.y ?? 0),
                                        0
                                    );
                                    const share = total ? (count / total) * 100 : 0;
                                    return tooltipCard(
                                        this.name ?? String(this.category ?? ''),
                                        `${count}` +
                                            unit(
                                                `film${count === 1 ? '' : 's'} · ${share.toFixed(1)}%`
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
    }, [currentDonutChartData, mobileBarData, handleCategoryClick]);

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
            return selectedCategory === 'language'
                ? 'Films in Other Languages'
                : 'Films from Other Countries';
        }
        switch (selectedCategory) {
            case 'country':
                return `Films from ${selectedPieSliceName}`;
            case 'language':
                return `Films in ${selectedPieSliceName}`;
            case 'decade':
                return `Films Released in the ${selectedPieSliceName}`;
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
