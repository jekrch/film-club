import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import StatCard from '../components/almanac/StatCard';
import ChartContainer from '../components/almanac/ChartContainer';
import CategorySelector from '../components/almanac/CategorySelector';
import FilteredFilmListSection from '../components/almanac/FilteredFilmSection';
import IntervalDetailDisplay from '../components/almanac/IntervalDetailDisplay';
import MemberStatCard from '../components/almanac/MemberStatCard';
import {
    parseRuntime, 
    formatAverage as formatAverageUtil, 
    calculateMemberStats, 
    ComprehensiveMemberStats, 
    MemberStatHighlight 
} from '../utils/statUtils'; 

// Helper Functions (Local to AlmanacPage - not shared or specific formatting)
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) { return "0 days : 00 hrs : 00 m"; }
    const minutesPerDay = 1440; const minutesPerHour = 60;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;
    const pad = (num: number) => String(num).padStart(2, '0');
    const dayLabel = days === 1 ? 'day' : 'days';
    return `${days} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m`;
};
const parseWatchDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) { console.warn(`Invalid date format: ${dateString}`); return null; }
    const [monthStr, dayStr, yearStr] = parts;
    const month = parseInt(monthStr, 10); const day = parseInt(dayStr, 10); let year = parseInt(yearStr, 10);
    if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) { console.warn(`Invalid date parts: ${dateString}`); return null; }
    if (yearStr.length <= 2 && year >= 0 && year < 100) { year += (year < 50) ? 2000 : 1900; }
    if (year < 1900 || year > new Date().getFullYear() + 5) { console.warn(`Year out of range: ${dateString}`); return null; }
    try {
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        if (dateObj.getUTCFullYear() === year && dateObj.getUTCMonth() === month - 1 && dateObj.getUTCDate() === day) return dateObj;
        else { console.warn(`Invalid date construction: ${dateString}`); return null; }
    } catch (e) { console.error(`Error creating Date: ${dateString}`, e); return null; }
};
const daysBetween = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
    const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
    return Math.floor(Math.abs(utc2 - utc1) / oneDay);
};

const formatAverage = (avg: number | null | undefined, digits = 1): string => {
    const formatted = formatAverageUtil(avg, digits); // Use the util function
    return formatted === null ? 'N/A' : formatted; // Add 'N/A' handling locally
};
const formatYear = (year: number | null | undefined): string => {
    if (year === null || year === undefined || isNaN(year)) return 'N/A';
    return Math.round(year).toString();
};


// Types (Exporting necessary types for MemberStatCard)
export type ChartCategory = 'country' | 'language' | 'decade';
type FilmWithDate = Film & { parsedWatchDate: Date };
interface IntervalDetail {
    startDate: Date; endDate: Date; days: number; films: FilmWithDate[]; // Use FilmWithDate consistently
}
export interface MemberStatsData {
    member: TeamMember;
    stats: ComprehensiveMemberStats; // Use the comprehensive type
    highlights: { // Keep the highlight structure, keys match ComprehensiveMemberStats
        avgRuntime: MemberStatHighlight; // Renamed from avgSelectionRuntime
        avgSelectedScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight; // Kept specific name for clarity if needed
        avgSelectionYear: MemberStatHighlight;
    };
}

// AlmanacPage Component
const AlmanacPage: React.FC = () => {
    // General Stats State
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [totalFilmsCount, setTotalFilmsCount] = useState<number>(0);
    const [watchedFilmsCount, setWatchedFilmsCount] = useState<number>(0);
    const [allFilmsData, setAllFilmsData] = useState<Film[]>([]);
    const [watchedFilmsSorted, setWatchedFilmsSorted] = useState<FilmWithDate[]>([]);
    const [foundingDate, setFoundingDate] = useState<Date | null>(null);
    const [daysActive, setDaysActive] = useState<number | null>(null);

    // Donut Chart State
    const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('country');
    const [countryChartData, setCountryChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [languageChartData, setLanguageChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [decadeChartData, setDecadeChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [selectedPieSliceName, setSelectedPieSliceName] = useState<string | null>(null);
    const [filteredFilmsForPieSlice, setFilteredFilmsForPieSlice] = useState<Film[]>([]);

    // Interval Chart State
    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(null);

    // User Stats State
    const [allMemberStats, setAllMemberStats] = useState<MemberStatsData[]>([]);

    // Ref for the filtered film list container
    const filmListRef = useRef<HTMLDivElement>(null);

    // Main Data Processing & Stats Calculation Effect
    useEffect(() => {
        const films = filmData;
        setAllFilmsData(films);
        setTotalFilmsCount(films.length);

        // Process watched films
        const watchedWithDates = films.map(f => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) })).filter(f => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort((a, b) => a.pDate.getTime() - b.pDate.getTime());
        const finalSortedWatched: FilmWithDate[] = sortedWatched.map(({ pDate, ...rest }) => ({ ...rest, parsedWatchDate: pDate }));
        setWatchedFilmsSorted(finalSortedWatched);
        setWatchedFilmsCount(finalSortedWatched.length);

        // Calculate Founding Date and Days Active
        if (finalSortedWatched.length > 0) {
            const firstDate = finalSortedWatched[0].parsedWatchDate;
            setFoundingDate(firstDate);
            const today = new Date();
            setDaysActive(daysBetween(firstDate, today));
        } else {
            setFoundingDate(null);
            setDaysActive(null);
        }

        // Calculate Total Runtime (Uses imported parseRuntime)
        const totalMinutes = finalSortedWatched.reduce((sum, film) => {
            const rt = parseRuntime(film.runtime); // Use imported helper
            if (rt !== null) return sum + rt;
            return sum;
        }, 0);
        setTotalRuntimeString(formatTotalMinutes(totalMinutes));

        // Process Donut Chart Data
        const countryCounts = new Map<string, number>();
        const languageCounts = new Map<string, number>();
        const decadeCounts = new Map<string, number>();
        films.forEach(film => {
            if (film?.country?.trim() && film.country !== "N/A") {
                const primaryCountry = film.country.split(',')[0].trim();
                countryCounts.set(primaryCountry, (countryCounts.get(primaryCountry) || 0) + 1);
            }
            if (film?.language?.trim() && film.language !== "N/A") {
                const primaryLanguage = film.language.split(',')[0].trim();
                languageCounts.set(primaryLanguage, (languageCounts.get(primaryLanguage) || 0) + 1);
            }
            if (film?.year?.substring(0, 4)) {
                const yearNum = parseInt(film.year.substring(0, 4), 10);
                if (!isNaN(yearNum) && yearNum > 1000) {
                    const decadeLabel = `${Math.floor(yearNum / 10) * 10}s`;
                    decadeCounts.set(decadeLabel, (decadeCounts.get(decadeLabel) || 0) + 1);
                }
            }
        });
        const formatAndSort = (map: Map<string, number>) => Array.from(map.entries()).map(([name, y]) => ({ name, y })).sort((a, b) => b.y - a.y);
        setCountryChartData(formatAndSort(countryCounts));
        setLanguageChartData(formatAndSort(languageCounts));
        setDecadeChartData(Array.from(decadeCounts.entries()).map(([name, y]) => ({ name, y })).sort((a, b) => parseInt(a.name) - parseInt(b.name)));

        // Process Interval Chart Data
        const intervals: Highcharts.PointOptionsObject[] = [];
        const intervalCategories: string[] = [];
        if (finalSortedWatched.length > 1) {
            for (let i = 1; i < finalSortedWatched.length; i++) {
                const date1 = finalSortedWatched[i - 1].parsedWatchDate;
                const date2 = finalSortedWatched[i].parsedWatchDate;
                const intervalDays = daysBetween(date1, date2);
                const categoryLabel = date2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                intervalCategories.push(`${categoryLabel}`);
                intervals.push({
                    y: intervalDays,
                    intervalIndex: i, // Store index corresponding to the end date film
                    startDate: date1.getTime(),
                    endDate: date2.getTime(),
                    category: finalSortedWatched[i].title // Store film title for tooltip
                } as any);
            }
        }
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);

        // Process Team Members & Calculate All Stats + Highlights
        const active = (teamMembersData as TeamMember[]).filter(m => typeof m.queue === 'number' && m.queue > 0).sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
        // Use the imported calculateMemberStats here
        const memberStatsList = active.map(member => ({
            member,
            stats: calculateMemberStats(member.name, films) // Use the imported function
        }));

        // Determine High/Low values using ComprehensiveMemberStats keys
        // Need to adjust keys for highlights: avgSelectionRuntime -> avgRuntime, selectionCountryCount remains
        const findHighLow = (statKey: keyof ComprehensiveMemberStats): { high: number | null, low: number | null } => {
            let high: number | null = null; let low: number | null = null; let validStatsCount = 0;
            memberStatsList.forEach(({ stats }) => {
                const value = stats[statKey];
                if (value !== null && typeof value === 'number' && !isNaN(value)) {
                    validStatsCount++;
                    if (high === null || value > high) high = value;
                    if (low === null || value < low) low = value;
                }
            });
            return validStatsCount >= 2 ? { high, low } : { high: null, low: null };
        };
        const highlightsMap = {
            avgRuntime: findHighLow('avgRuntime'), // Adjusted key
            avgSelectedScore: findHighLow('avgSelectedScore'),
            avgGivenScore: findHighLow('avgGivenScore'),
            selectionCountryCount: findHighLow('selectionCountryCount'), // Key from ComprehensiveMemberStats
            avgSelectionYear: findHighLow('avgSelectionYear'),
        };

        // Combine stats with highlight info
        const finalStatsData: MemberStatsData[] = memberStatsList.map(({ member, stats }) => {
             const getHighlight = (statKey: keyof MemberStatsData['highlights'], value: number | null): MemberStatHighlight => {
                if (value === null || typeof value !== 'number' || isNaN(value)) return null;
                // @ts-ignore
                // Map the highlight key back to the ComprehensiveMemberStats key for lookup
                let lookupKey: keyof ComprehensiveMemberStats | undefined = undefined;
                switch (statKey) {
                    case 'avgRuntime': lookupKey = 'avgRuntime'; break;
                    case 'avgSelectedScore': lookupKey = 'avgSelectedScore'; break;
                    case 'avgGivenScore': lookupKey = 'avgGivenScore'; break;
                    case 'selectionCountryCount': lookupKey = 'selectionCountryCount'; break; // or countryCount
                    case 'avgSelectionYear': lookupKey = 'avgSelectionYear'; break;
                    default: return null; // Should not happen
                }
                const { high, low } = (highlightsMap as any)[statKey]; // Use the original key for lookup in highlightsMap
                const isHigh = high !== null && value === high && high !== low;
                const isLow = low !== null && value === low && high !== low;

                // No low highlight for country count (specific Almanac logic)
                if (statKey === 'selectionCountryCount' && isLow) return null;

                if (isHigh) return 'high';
                if (isLow) return 'low';
                return null;
            };
            return {
                member, stats, highlights: { // Use the highlight keys expected by MemberStatCard
                    avgRuntime: getHighlight('avgRuntime', stats.avgRuntime),
                    avgSelectedScore: getHighlight('avgSelectedScore', stats.avgSelectedScore),
                    avgGivenScore: getHighlight('avgGivenScore', stats.avgGivenScore),
                    selectionCountryCount: getHighlight('selectionCountryCount', stats.selectionCountryCount),
                    avgSelectionYear: getHighlight('avgSelectionYear', stats.avgSelectionYear),
                }
            };
        });
        setAllMemberStats(finalStatsData);

    }, []); // Run once on mount (calculateMemberStats is stable)

    // Chart Options
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

    // Pie Slice/Label/Bar/Bar Label Click Handler
    const handleCategoryClick = useCallback((point: Highcharts.Point) => {
        const sliceName = point.name;
        const isDeselecting = sliceName === selectedPieSliceName;

        if (isDeselecting) {
            setSelectedPieSliceName(null);
            setFilteredFilmsForPieSlice([]);
            return;
        }

        let filtered: Film[] = [];
        switch (selectedCategory) {
            case 'country':
                filtered = allFilmsData.filter(film => film?.country?.trim() && film.country !== "N/A" && film.country.split(',')[0].trim() === sliceName);
                break;
            case 'language':
                filtered = allFilmsData.filter(film => film?.language?.trim() && film.language !== "N/A" && film.language.split(',')[0].trim() === sliceName);
                break;
            case 'decade':
                filtered = allFilmsData.filter(film => {
                    if (film?.year?.substring(0, 4)) {
                        const yearNum = parseInt(film.year.substring(0, 4), 10);
                        if (!isNaN(yearNum) && yearNum > 1000) {
                            const decadeLabel = `${Math.floor(yearNum / 10) * 10}s`;
                            return decadeLabel === sliceName;
                        }
                    }
                    return false;
                });
                break;
            default: filtered = [];
        }

        setSelectedPieSliceName(sliceName);
        setFilteredFilmsForPieSlice(filtered);
        // Scroll logic handled by useEffect below
    }, [selectedCategory, allFilmsData, selectedPieSliceName]);

    // Effect to scroll to the film list when it appears
    useEffect(() => {
        if (selectedPieSliceName && filmListRef.current) {
            filmListRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedPieSliceName]);

    // Donut/Bar Chart Options
    const donutChartOptions = useMemo((): Highcharts.Options => {
        // Height calculation for responsive bar chart
        const pointWidthForCalc = 15;
        const verticalPaddingPerBar = 15;
        const topBottomChartMargin = 80;
        const minChartHeight = 200;
        let calculatedHeight = minChartHeight;
        const numberOfCategories = currentDonutChartData ? currentDonutChartData.length : 0;
        if (numberOfCategories > 0) {
            calculatedHeight = (numberOfCategories * (pointWidthForCalc + verticalPaddingPerBar)) + topBottomChartMargin;
            calculatedHeight = Math.max(calculatedHeight, minChartHeight);
        }

        const options: Highcharts.Options = {
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
                bar: { // Base bar options for click handler
                    point: { events: { click: function () { handleCategoryClick(this); } } }
                },
            },
            series: [{ name: 'Films', colorByPoint: true, type: 'pie', data: currentDonutChartData as any[] } as any],
            credits: { enabled: false },
            colors: ['#b76e41', '#d9a534', '#1a7b6d', '#be5a38', '#6b7da3', '#a34a6a', '#2c815c', '#c88b3a', '#734f8c', '#b35450', '#a87c5f', '#d3a064', '#5f7464', '#946b54', '#7c6a53', '#85594c', '#4e6e81', '#8f4e5b', '#5c6e58', '#8d7471']
        };

        // Responsive rule
        options.responsive = {
            rules: [{
                condition: { maxWidth: 640 },
                chartOptions: {
                    chart: { type: 'bar', height: calculatedHeight },
                    xAxis: {
                        categories: numberOfCategories > 0 ? currentDonutChartData.map(d => d.name) : [],
                        title: { text: null }, labels: { style: { color: '#9ca3af', fontSize: '10px' } },
                        lineColor: '#4b5563', tickColor: '#4b5563',
                    },
                    yAxis: { title: { text: 'Number of Films', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
                    plotOptions: {
                        column: { pointPadding: 0.1, borderWidth: 0, color: '#1a7b6d', pointWidth: 15, groupPadding: 0.1 }, // Retained for potential future use, inactive for bar
                        pie: { dataLabels: { enabled: false } },
                        bar: {
                            borderColor: '#1f2937',
                            dataLabels: {
                                enabled: true, align: 'right', color: '#d1d5db',
                                style: { textOutline: 'none', fontWeight: 'normal', fontSize: '10px', cursor: 'pointer' },
                                format: '{point.y}', inside: false,
                                events: { click: function () { handleCategoryClick(this.point); } } as any
                            },
                            showInLegend: false, pointWidth: pointWidthForCalc,
                            // Point click handled by base bar options
                        }
                    },
                    tooltip: { pointFormat: '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)' },
                    series: [{ name: 'Films', type: 'bar', data: currentDonutChartData as any[] }]
                } as Highcharts.Options
            }]
        };
        return options;
    }, [currentDonutChartData, currentDonutChartTitle, handleCategoryClick]);

    // Interval Chart Click Handler
    const handleIntervalClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any; // Access custom properties
        const intervalIndex = point.intervalIndex;

        // Ensure index is valid and corresponds to an actual interval end point
        if (typeof intervalIndex === 'number' && intervalIndex >= 1 && intervalIndex < watchedFilmsSorted.length) {
            const startDate = new Date(point.startDate);
            const endDate = new Date(point.endDate);
            const days = point.y;
            // Get the single film watched AT the end of this interval
            const filmsInInterval = watchedFilmsSorted.slice(intervalIndex, intervalIndex + 1);
            setSelectedIntervalDetail({ startDate, endDate, days, films: filmsInInterval });
        } else {
             // Handle cases like clicking the very first (non-interval) point if chart rendered it, or bad data.
             // The current logic starts intervals from index 1, so index 0 shouldn't trigger this based on intervalIndex.
            setSelectedIntervalDetail(null);
            console.warn("Invalid interval data or click target:", point);
        }
    }, [watchedFilmsSorted]);


    // Interval Chart Options
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
                 const point = this.points as any; // Cast to access custom properties
                 // Display days and the film watched on the END date of the interval
                 return `<b>${point.y} days</b><br/>Interval ended on: ${this.key}<br/>Film: <i>${point.options.category}</i>`; // this.key is the category label (date)
             },
             backgroundColor: 'rgba(31, 41, 55, 0.9)', borderColor: '#4b5563', style: { color: '#f3f4f6' }
         },
        plotOptions: {
            line: {
                lineWidth: 2,
                marker: { enabled: true, radius: 4, fillColor: '#f3f4f6', lineColor: '#b76e41', lineWidth: 1 },
                states: { hover: { lineWidth: 3 } }
            },
            series: { // General series options apply to line
                cursor: 'pointer',
                point: { events: { click: handleIntervalClick } }
            }
        },
        series: [{ name: 'Days Between Meetings', type: 'line', color: '#b76e41', data: meetingIntervalData as any[] }],
        credits: { enabled: false }
    }), [meetingIntervalData, meetingIntervalCategories, handleIntervalClick]);

    // Helper to get highlight class
    const getHighlightClass = useCallback((highlight: MemberStatHighlight): string => {
        if (highlight === 'high') return 'text-emerald-400 font-semibold';
        if (highlight === 'low') return 'text-blue-400 font-semibold';
        return 'text-slate-100 font-medium'; // Default class for value
    },[]);

    // Dynamic Title for Filtered Film List
    const filteredListTitle = useMemo(() => {
        if (!selectedPieSliceName) return '';
        switch (selectedCategory) {
            case 'country': return `Films from ${selectedPieSliceName}`;
            case 'language': return `Films in ${selectedPieSliceName}`;
            case 'decade': return `Films Released in the ${selectedPieSliceName}`;
            default: return 'Selected Films';
        }
    }, [selectedCategory, selectedPieSliceName]);

    // Category Change Handler
    const handleCategorySelected = useCallback((category: ChartCategory) => {
        setSelectedCategory(category);
        setSelectedPieSliceName(null); // Deselect when changing category
        setFilteredFilmsForPieSlice([]);
    }, []);

    // Close Handlers
    const closeFilteredList = useCallback(() => {
        setSelectedPieSliceName(null);
        setFilteredFilmsForPieSlice([]);
    }, []);

    const closeIntervalDetail = useCallback(() => {
        setSelectedIntervalDetail(null);
    }, []);

    // Render Logic
    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 !pt-6 text-slate-200">

            <div className="!text-2xl sm:text-4xl font-bold text-slate-300 text-center border-b border-slate-700 pb-4">
                Almanac
            </div>

            {/* Header Section */}
            {foundingDate && daysActive !== null && (
                <div className="text-center mb-6 mt-3 text-slate-400 border-b border-slate-700 pb-3">
                    <p className="text-sm sm:text-base">
                        Founded on <span className="font-semibold text-slate-300">{foundingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
                        <div className="text-xs mt-1">Active <span className="text-slate-200">{daysActive.toLocaleString()}</span> days</div>
                    </p>
                </div>
            )}

            {/* General Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
                <StatCard
                    label="Total Watch Time"
                    value={totalRuntimeString || "..."}
                    description={`Across ${watchedFilmsCount} watched films.`}
                />
                <StatCard
                    label="Total Films Logged"
                    value={totalFilmsCount}
                    description="Watched & upcoming."
                />
            </div>

            {/* Donut/Bar Chart Section */}
            <ChartContainer className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-4">
                 <CategorySelector
                     categories={['country', 'language', 'decade']}
                     selectedCategory={selectedCategory}
                     onSelectCategory={handleCategorySelected}
                 />
                 <p className="mb-2 text-center text-xs text-slate-400 mt-3 italic">
                     Click on a category slice, bar, or label to view the corresponding films below.
                 </p>
                 {currentDonutChartData.length > 0 ? (
                     <HighchartsReact highcharts={Highcharts} options={donutChartOptions} />
                 ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading chart...</div>)}
             </ChartContainer>


            {/* Filtered Film List Section */}
            {selectedPieSliceName && (
                <FilteredFilmListSection
                    listRef={filmListRef as any}
                    title={filteredListTitle}
                    films={filteredFilmsForPieSlice}
                    onClose={closeFilteredList}
                    layoutMode='horizontal'
                    hideSizeButtons={true}
                />
            )}

            {/* Interval Chart Section */}
             <ChartContainer className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-8 sm:mb-10">
                 <p className="mb-2 text-center text-xs text-slate-400 italic">
                     Click on a point to see which film was watched at the end of that interval.
                 </p>
                 {meetingIntervalData.length > 0 ? (
                     <HighchartsReact highcharts={Highcharts} options={meetingIntervalChartOptions} />
                 ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading intervals...</div>)}
                 {selectedIntervalDetail && (
                     <IntervalDetailDisplay
                         detail={selectedIntervalDetail}
                         onClose={closeIntervalDetail}
                     />
                 )}
             </ChartContainer>

            {/* User Stats Section */}
            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">Member Stats Breakdown</h3>
                {allMemberStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                         {allMemberStats.map(({ member, stats, highlights }) => (
                             <MemberStatCard
                                 key={member.name}
                                 member={member}
                                 stats={{ 
                                    totalSelections: stats.totalSelections,
                                    avgRuntime: stats.avgRuntime,
                                    avgSelectedScore: stats.avgSelectedScore,
                                    avgGivenScore: stats.avgGivenScore,
                                    selectionCountryCount: stats.selectionCountryCount, // or stats.countryCount
                                    avgSelectionYear: stats.avgSelectionYear,
                                 } as any}
                                 highlights={highlights as any}
                                 formatAverage={formatAverage} // Pass the local formatter
                                 formatYear={formatYear} // Pass the local formatter
                                 getHighlightClass={getHighlightClass as any}
                             />
                         ))}
                    </div>
                ) : (<p className="text-center text-sm text-slate-400 italic py-4">Calculating member stats...</p>)}
            </div>

        </div> // End Main Container
    );
};

export default AlmanacPage;