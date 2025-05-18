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
    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(null);

    useEffect(() => {
        setAllFilmsDataState(filmsInput); // Update if input changes
    }, [filmsInput]);


    useEffect(() => {
        // Process watched films
        const watchedWithDates = allFilmsDataState
            .map(f => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) }))
            .filter(f => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort((a, b) => a.pDate.getTime() - b.pDate.getTime());
        const finalSortedWatched: FilmWithDate[] = sortedWatched.map(({ pDate, ...rest }) => ({ ...rest, parsedWatchDate: pDate }));
        setWatchedFilmsSorted(finalSortedWatched);

        // Process Donut Chart Data
        const countryCounts = new Map<string, number>();
        const languageCounts = new Map<string, number>();
        const decadeCounts = new Map<string, number>();

        allFilmsDataState.forEach(film => {
            if (film?.country?.trim() && film.country.toLowerCase() !== "n/a") {
                const primaryCountry = film.country.split(',')[0].trim();
                countryCounts.set(primaryCountry, (countryCounts.get(primaryCountry) || 0) + 1);
            }
            if (film?.language?.trim() && film.language.toLowerCase() !== "n/a") {
                const primaryLanguage = film.language.split(',')[0].trim();
                languageCounts.set(primaryLanguage, (languageCounts.get(primaryLanguage) || 0) + 1);
            }
            if (film?.year?.substring(0, 4)) {
                const yearNum = parseInt(film.year.substring(0, 4), 10);
                if (!isNaN(yearNum) && yearNum > 1000) { // Basic year validation
                    const decadeLabel = `${Math.floor(yearNum / 10) * 10}s`;
                    decadeCounts.set(decadeLabel, (decadeCounts.get(decadeLabel) || 0) + 1);
                }
            }
        });

        const formatAndSort = (map: Map<string, number>) => Array.from(map.entries()).map(([name, y]) => ({ name, y })).sort((a, b) => b.y - a.y);
        setCountryChartData(formatAndSort(countryCounts));
        setLanguageChartData(formatAndSort(languageCounts));
        setDecadeChartData(Array.from(decadeCounts.entries()).map(([name, y]) => ({ name, y })).sort((a, b) => parseInt(a.name) - parseInt(b.name))); // Sort decades chronologically

        // Process Interval Chart Data
        const intervals: Highcharts.PointOptionsObject[] = [];
        const intervalCategories: string[] = [];
        if (finalSortedWatched.length > 1) {
            for (let i = 1; i < finalSortedWatched.length; i++) {
                const date1 = finalSortedWatched[i - 1].parsedWatchDate;
                const date2 = finalSortedWatched[i].parsedWatchDate;
                const intervalDays = daysBetween(date1, date2);
                const categoryLabel = date2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
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
            case 'language': return languageChartData;
            case 'decade': return decadeChartData;
            case 'country': default: return countryChartData;
        }
    }, [selectedCategory, countryChartData, languageChartData, decadeChartData]);

    const currentDonutChartTitle = useMemo(() => {
        switch (selectedCategory) {
            case 'language': return 'Films by Primary Language';
            case 'decade': return 'Films by Decade of Release';
            case 'country': default: return 'Films by Country of Origin';
        }
    }, [selectedCategory]);

    const handleCategoryClick = useCallback((point: Highcharts.Point) => {
        const sliceName = point.name;
        if (sliceName === selectedPieSliceName) {
            setSelectedPieSliceName(null);
            setFilteredFilmsForPieSlice([]);
            return;
        }

        let filtered: Film[] = [];
        switch (selectedCategory) {
            case 'country':
                filtered = allFilmsDataState.filter(film => film?.country?.split(',')[0].trim() === sliceName);
                break;
            case 'language':
                filtered = allFilmsDataState.filter(film => film?.language?.split(',')[0].trim() === sliceName);
                break;
            case 'decade':
                filtered = allFilmsDataState.filter(film => {
                    const yearNum = parseInt(film.year?.substring(0, 4) || '0', 10);
                    return !isNaN(yearNum) && yearNum > 1000 && `${Math.floor(yearNum / 10) * 10}s` === sliceName;
                });
                break;
        }
        setSelectedPieSliceName(sliceName);
        setFilteredFilmsForPieSlice(filtered);
    }, [selectedCategory, allFilmsDataState, selectedPieSliceName]);

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
         const numberOfCategories = currentDonutChartData.length;
         let calculatedHeight = Math.max((numberOfCategories * (pointWidthForCalc + verticalPaddingPerBar)) + topBottomChartMargin, minChartHeight);

        return {
            chart: { type: 'pie', backgroundColor: '', style: { fontFamily: 'Inter, sans-serif' } },
            title: { text: currentDonutChartTitle, style: { color: '#d1d5db' } },
            tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} film{point.plural})', backgroundColor: 'rgba(31, 41, 55, 0.9)', borderColor: '#4b5563', style: { color: '#f3f4f6' } },
            accessibility: { point: { valueSuffix: '%' } },
            plotOptions: {
                pie: {
                    allowPointSelect: true, cursor: 'pointer', borderColor: '#374151', innerSize: '60%', size: '90%',
                    dataLabels: {
                        enabled: true, format: '{point.name}: {point.percentage:.1f}%', distance: 20,
                        style: { color: '#d1d5db', textOutline: 'none', fontWeight: 'normal', fontSize: '11px', cursor: 'pointer' },
                        connectorColor: '#6b7280', filter: { property: 'percentage', operator: '>', value: 3 },
                        events: { click: function () { handleCategoryClick(this.point); } } as any
                    } as any,
                    showInLegend: false,
                    point: { events: { click: function () { handleCategoryClick(this); } } }
                },
            },
            series: [{ name: 'Films', type: 'pie', data: currentDonutChartData as any[] }],
            credits: { enabled: false },
            colors: ['#b76e41', '#d9a534', '#1a7b6d', '#be5a38', '#6b7da3', '#a34a6a', '#2c815c', '#c88b3a', '#734f8c', '#b35450', '#a87c5f', '#d3a064', '#5f7464', '#946b54', '#7c6a53', '#85594c', '#4e6e81', '#8f4e5b', '#5c6e58', '#8d7471'],
             responsive: {
                rules: [{
                    condition: { maxWidth: 640 },
                    chartOptions: {
                        chart: { type: 'bar', height: calculatedHeight },
                        xAxis: {
                            categories: currentDonutChartData.map(d => d.name || ''),
                            title: { text: null }, labels: { style: { color: '#9ca3af', fontSize: '10px' } },
                            lineColor: '#4b5563', tickColor: '#4b5563',
                        },
                        yAxis: { title: { text: 'Number of Films', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
                        plotOptions: {
                            pie: { dataLabels: { enabled: false } } as Highcharts.PlotPieOptions,
                            bar: {
                                borderColor: '#1f2937',
                                dataLabels: {
                                    enabled: true, align: 'right', color: '#d1d5db',
                                    style: { textOutline: 'none', fontWeight: 'normal', fontSize: '10px', cursor: 'pointer' },
                                    format: '{point.y}', inside: false,
                                    events: { click: function () { handleCategoryClick(this.point); } } as any
                                },
                                showInLegend: false, pointWidth: pointWidthForCalc,
                                point: { events: { click: function () { handleCategoryClick(this); } } }
                            } as Highcharts.PlotBarOptions
                        },
                        tooltip: { pointFormat: '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)' },
                        series: [{ name: 'Films', type: 'bar', data: currentDonutChartData as any[] }]
                    }
                }]
            }
        };
    }, [currentDonutChartData, currentDonutChartTitle, handleCategoryClick]);


    const handleIntervalClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any;
        const intervalIndex = point.intervalIndex;
        if (typeof intervalIndex === 'number' && intervalIndex >= 1 && intervalIndex < watchedFilmsSorted.length) {
            setSelectedIntervalDetail({
                startDate: new Date(point.startDate),
                endDate: new Date(point.endDate),
                days: point.y,
                films: watchedFilmsSorted.slice(intervalIndex, intervalIndex + 1) // Film at the END of the interval
            });
        } else {
            setSelectedIntervalDetail(null);
        }
    }, [watchedFilmsSorted]);

    const meetingIntervalChartOptions = useMemo((): Highcharts.Options => ({
        chart: { type: 'line', backgroundColor: '', style: { fontFamily: 'Inter, sans-serif' } },
        title: { text: 'Time Between Club Meetings', style: { color: '#d1d5db' } },
        xAxis: {
            categories: meetingIntervalCategories,
            labels: { rotation: -45, style: { color: '#9ca3af', fontSize: '10px' } },
            lineColor: '#4b5563', tickColor: '#4b5563'
        },
        yAxis: { min: 0, title: { text: 'Days Since Last Meeting', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
        legend: { enabled: false },
        tooltip: {
            formatter: function () {
                const point = this.points as any; // Access custom properties
                return `<b>${point.y} days</b><br/>Interval ended on: ${this.category}<br/>Film: <i>${point.options.category}</i>`;
            },
            backgroundColor: 'rgba(31, 41, 55, 0.9)', borderColor: '#4b5563', style: { color: '#f3f4f6' }
        },
        plotOptions: {
            line: {
                lineWidth: 2,
                marker: { enabled: true, radius: 4, fillColor: '#f3f4f6', lineColor: '#b76e41', lineWidth: 1 },
                states: { hover: { lineWidth: 3 } }
            },
            series: {
                cursor: 'pointer',
                point: { events: { click: handleIntervalClick } }
            }
        },
        series: [{ name: 'Days Between Meetings', type: 'line', color: '#b76e41', data: meetingIntervalData as any[] }],
        credits: { enabled: false }
    }), [meetingIntervalData, meetingIntervalCategories, handleIntervalClick]);

    const closeFilteredList = useCallback(() => {
        setSelectedPieSliceName(null);
        setFilteredFilmsForPieSlice([]);
    }, []);

    const closeIntervalDetail = useCallback(() => {
        setSelectedIntervalDetail(null);
    }, []);

    const filteredListTitle = useMemo(() => {
        if (!selectedPieSliceName) return '';
        switch (selectedCategory) {
            case 'country': return `Films from ${selectedPieSliceName}`;
            case 'language': return `Films in ${selectedPieSliceName}`;
            case 'decade': return `Films Released in the ${selectedPieSliceName}`;
            default: return 'Selected Films';
        }
    }, [selectedCategory, selectedPieSliceName]);


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