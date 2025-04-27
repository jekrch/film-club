import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// --- Data & Types ---
import { Film } from '../types/film'; // Adjust path as needed
import { TeamMember, teamMembers as teamMembersData } from '../types/team'; // Adjust path as needed
import filmsData from '../assets/films.json'; // Adjust path as needed

// --- Components ---
import CircularImage from '../components/common/CircularImage'; // Adjust path as needed
import FilmList from '../components/films/FilmList'; // Using FilmList component - MAKE SURE PATH IS CORRECT

// --- Utils ---
import { calculateClubAverage } from '../utils/ratingUtils'; // Adjust path as needed

// --- Helper Functions (Keep or move to utils - unchanged) ---
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
    return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
};
const formatAverage = (avg: number | null | undefined, digits = 1): string => {
    if (avg === null || avg === undefined || isNaN(avg)) return 'N/A';
    return avg.toFixed(digits);
};
const formatYear = (year: number | null | undefined): string => {
    if (year === null || year === undefined || isNaN(year)) return 'N/A';
    return Math.round(year).toString();
};

// --- Types (unchanged) ---
type ChartCategory = 'country' | 'language' | 'decade';
type FilmWithDate = Film & { parsedWatchDate: Date };
interface UserStats {
    selectionCount: number;
    avgSelectionRuntime: number | null;
    avgSelectionScore: number | null;
    avgGivenScore: number | null;
    selectionCountryCount: number;
    avgSelectionYear: number | null;
}
interface IntervalDetail {
    startDate: Date; endDate: Date; days: number; films: Film[];
}
type MemberStatHighlight = 'high' | 'low' | null;
interface MemberStatsData {
    member: TeamMember;
    stats: UserStats;
    highlights: {
        avgSelectionRuntime: MemberStatHighlight;
        avgSelectionScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight;
        avgSelectionYear: MemberStatHighlight;
    };
}

// --- AlmanacPage Component ---
const AlmanacPage: React.FC = () => {
    // General Stats State
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [totalFilmsCount, setTotalFilmsCount] = useState<number>(0);
    const [watchedFilmsCount, setWatchedFilmsCount] = useState<number>(0);
    const [allFilmsData, setAllFilmsData] = useState<Film[]>([]); // <-- Store all films for filtering
    const [watchedFilmsSorted, setWatchedFilmsSorted] = useState<FilmWithDate[]>([]);

    // Donut Chart State
    const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('country');
    const [countryChartData, setCountryChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [languageChartData, setLanguageChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [decadeChartData, setDecadeChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [selectedPieSliceName, setSelectedPieSliceName] = useState<string | null>(null); // <-- State for selected slice name
    const [filteredFilmsForPieSlice, setFilteredFilmsForPieSlice] = useState<Film[]>([]); // <-- State for filtered films

    // Interval Chart State
    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(null);

    // User Stats State
    //const [activeMembers, setActiveMembers] = useState<TeamMember[]>([]); // Removed if not used directly
    const [allMemberStats, setAllMemberStats] = useState<MemberStatsData[]>([]);

    // --- Stat Calculation Function (for one user - unchanged) ---
    const calculateUserStats = useCallback((userName: string, films: Film[]): UserStats => {
        // ... (same implementation as before)
        const userSelections = films.filter(film => film.movieClubInfo?.selector === userName);
        const selectionCount = userSelections.length;

        // Avg Runtime
        let totalRuntime = 0; let runtimeCount = 0;
        userSelections.forEach(film => {
            if (film?.runtime && typeof film.runtime === 'string') {
                const minutes = parseInt(film.runtime.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(minutes)) { totalRuntime += minutes; runtimeCount++; }
            }
        });
        const avgSelectionRuntime = runtimeCount > 0 ? totalRuntime / runtimeCount : null;

        // Avg Selection Score
        let totalSelectionScore = 0; let selectionScoreCount = 0;
        userSelections.forEach(film => {
            const avg = calculateClubAverage(film.movieClubInfo?.clubRatings);
            if (avg !== null && !isNaN(avg)) { totalSelectionScore += avg; selectionScoreCount++; }
        });
        const avgSelectionScore = selectionScoreCount > 0 ? totalSelectionScore / selectionScoreCount : null;

        userName = userName.toLowerCase(); // Normalize userName for consistent access
        // Avg Given Score (FIXED ACCESS & HANDLING)
        let totalGivenScore = 0; let givenScoreCount = 0;
        films.forEach(film => {
            const ratings = film.movieClubInfo?.clubRatings;
            if (ratings && Object.prototype.hasOwnProperty.call(ratings, userName)) {
                const rating = ratings[userName as keyof typeof ratings];
                // Ensure rating is not null/undefined/empty string before converting
                if (rating !== null && rating !== undefined) {

                    const numericRating = Number(rating);
                    // Check if the result is a valid number (not NaN)
                    if (!isNaN(numericRating)) {
                        totalGivenScore += numericRating;
                        givenScoreCount++;
                    }
                }
            }
        });
        // Ensure division only happens if count > 0
        const avgGivenScore = givenScoreCount > 0 ? totalGivenScore / givenScoreCount : null;

        // Selection Country Count
        const countries = new Set<string>();
        userSelections.forEach(film => {
            if (film?.country?.trim() && film.country !== "N/A") {
                countries.add(film.country.split(',')[0].trim());
            }
        });
        const selectionCountryCount = countries.size;

        // Avg Selection Year
        let totalYear = 0; let yearCount = 0;
        userSelections.forEach(film => {
            if (film?.year?.substring(0, 4)) {
                const yearNum = parseInt(film.year.substring(0, 4), 10);
                if (!isNaN(yearNum) && yearNum > 1000) {
                    totalYear += yearNum;
                    yearCount++;
                }
            }
        });
        const avgSelectionYear = yearCount > 0 ? totalYear / yearCount : null;

        return {
            selectionCount, avgSelectionRuntime, avgSelectionScore, avgGivenScore,
            selectionCountryCount, avgSelectionYear
        };
    }, []); // Dependencies remain empty as films are passed in


    // --- Main Data Processing & Stats Calculation Effect ---
    useEffect(() => {
        const films = filmsData as unknown as Film[];
        setAllFilmsData(films); // <-- Store the raw films data
        setTotalFilmsCount(films.length);

        // Process watched films
        const watchedWithDates = films.map(f => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) })).filter(f => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort((a, b) => a.pDate.getTime() - b.pDate.getTime());
        const finalSortedWatched = sortedWatched.map(({ pDate, ...rest }) => ({ ...rest, parsedWatchDate: pDate }));
        setWatchedFilmsSorted(finalSortedWatched);
        setWatchedFilmsCount(finalSortedWatched.length);

        // Calculate Total Runtime
        const totalMinutes = finalSortedWatched.reduce((sum, film) => {
            if (film?.runtime && typeof film.runtime === 'string') {
                const minutes = parseInt(film.runtime.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(minutes)) return sum + minutes;
            } return sum;
        }, 0);
        setTotalRuntimeString(formatTotalMinutes(totalMinutes));

        // Process Donut Chart Data
        const countryCounts = new Map<string, number>();
        const languageCounts = new Map<string, number>();
        const decadeCounts = new Map<string, number>();
        films.forEach(film => {
            // Country
            if (film?.country?.trim() && film.country !== "N/A") {
                const primaryCountry = film.country.split(',')[0].trim();
                countryCounts.set(primaryCountry, (countryCounts.get(primaryCountry) || 0) + 1);
            }
            // Language
            if (film?.language?.trim() && film.language !== "N/A") {
                const primaryLanguage = film.language.split(',')[0].trim();
                languageCounts.set(primaryLanguage, (languageCounts.get(primaryLanguage) || 0) + 1);
            }
            // Decade
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
                const filmTitle = finalSortedWatched[i].title || `Meeting ${i + 1}`;
                const intervalDays = daysBetween(date1, date2);
                const categoryLabel = date2.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                intervalCategories.push(`${categoryLabel}: ${filmTitle}`);
                intervals.push({ y: intervalDays, intervalIndex: i, startDate: date1.getTime(), endDate: date2.getTime() } as any);
            }
        }
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);

        // Process Team Members & Calculate All Stats + Highlights
        const active = (teamMembersData as TeamMember[]).filter(m => typeof m.queue === 'number' && m.queue > 0).sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
        //setActiveMembers(active); // Removed if not used directly

        const memberStatsList = active.map(member => ({ member, stats: calculateUserStats(member.name, films) }));

        // Determine High/Low values
        const findHighLow = (statKey: keyof UserStats): { high: number | null, low: number | null } => {
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
            avgSelectionRuntime: findHighLow('avgSelectionRuntime'), avgSelectionScore: findHighLow('avgSelectionScore'),
            avgGivenScore: findHighLow('avgGivenScore'), selectionCountryCount: findHighLow('selectionCountryCount'),
            avgSelectionYear: findHighLow('avgSelectionYear'),
        };

        // Combine stats with highlight info
        const finalStatsData = memberStatsList.map(({ member, stats }) => {
            const getHighlight = (statKey: keyof UserStats, value: number | null): MemberStatHighlight => {
                if (value === null || typeof value !== 'number' || isNaN(value)) return null;
                const { high, low } = (highlightsMap as any)[statKey];
                if (high !== null && value === high && high !== low) return 'high';
                if (low !== null && value === low && high !== low) return 'low';
                return null;
            };
            return {
                member, stats, highlights: {
                    avgSelectionRuntime: getHighlight('avgSelectionRuntime', stats.avgSelectionRuntime),
                    avgSelectionScore: getHighlight('avgSelectionScore', stats.avgSelectionScore),
                    avgGivenScore: getHighlight('avgGivenScore', stats.avgGivenScore),
                    selectionCountryCount: getHighlight('selectionCountryCount', stats.selectionCountryCount),
                    avgSelectionYear: getHighlight('avgSelectionYear', stats.avgSelectionYear),
                }
            };
        });
        setAllMemberStats(finalStatsData);

    }, [calculateUserStats]); // Add calculateUserStats dependency

    // --- Chart Options ---
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

    // --- Pie Slice Click Handler ---
    const handlePieSliceClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any; // Use 'as any' as per requirement, otherwise define a Point type extension
        const sliceName = point.name;

        // If clicking the same slice again, deselect it
        if (sliceName === selectedPieSliceName) {
            setSelectedPieSliceName(null);
            setFilteredFilmsForPieSlice([]);
            return;
        }

        let filtered: Film[] = [];

        switch (selectedCategory) {
            case 'country':
                filtered = allFilmsData.filter(film =>
                    film?.country?.trim() && film.country !== "N/A" && film.country.split(',')[0].trim() === sliceName
                );
                break;
            case 'language':
                filtered = allFilmsData.filter(film =>
                    film?.language?.trim() && film.language !== "N/A" && film.language.split(',')[0].trim() === sliceName
                );
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
            default:
                filtered = [];
        }

        setSelectedPieSliceName(sliceName);
        setFilteredFilmsForPieSlice(filtered);

    }, [selectedCategory, allFilmsData, selectedPieSliceName]); // Dependencies for the click handler


    // --- Donut/Bar Chart Options (with click handler) ---
    const donutChartOptions = useMemo((): Highcharts.Options => {
        // Define base options
        const options: Highcharts.Options = {
            chart: { type: 'pie', backgroundColor: '', style: { fontFamily: 'Inter, sans-serif' } },
            title: { text: currentDonutChartTitle, style: { color: '#d1d5db' } },
            tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} film{point.plural})', backgroundColor: '', borderColor: '#4b5563', style: { color: '#f3f4f6' } },
            accessibility: { point: { valueSuffix: '%' } },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    borderColor: '#374151',
                    innerSize: '60%',
                    size: '90%',
                    dataLabels: { enabled: true, format: '{point.name}: {point.percentage:.1f}%', distance: 20, style: { color: '#d1d5db', textOutline: 'none', fontWeight: 'normal', fontSize: '11px' }, connectorColor: '#6b7280', filter: { property: 'percentage', operator: '>', value: 3 } },
                    showInLegend: false,
                    // Add click event to points (slices)
                    point: {
                        events: {
                            click: handlePieSliceClick // <-- Attach the handler
                        }
                    }
                },
                bar: {
                    dataLabels: { enabled: false },
                    // Add click event to points (bars) for responsive view
                    point: {
                        events: {
                            click: handlePieSliceClick // <-- Attach the handler here too
                        }
                    }
                },
                // General series options can also contain point events if needed universally
                // series: {
                //      cursor: 'pointer',
                //      point: {
                //          events: {
                //              click: handlePieSliceClick
                //          }
                //      }
                //  }
            },
            series: [{ name: 'Films', colorByPoint: true, type: 'pie', data: currentDonutChartData as any[] } as any], // Cast as any kept
            credits: { enabled: false },
            colors: ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#d946ef']
        };

        // Define responsive rule separately, checking for data existence
        options.responsive = {
            rules: [{
                condition: { maxWidth: 640 },
                chartOptions: {
                    chart: { type: 'bar' },
                    xAxis: {
                        categories: (currentDonutChartData && currentDonutChartData.length > 0)
                            ? currentDonutChartData.map(d => d.name)
                            : [],
                        title: { text: null },
                        labels: { style: { color: '#9ca3af', fontSize: '10px' } },
                        lineColor: '#4b5563', tickColor: '#4b5563'
                    },
                    yAxis: { title: { text: 'Number of Films', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
                    plotOptions: {
                        pie: { dataLabels: { enabled: false } }, // Disable pie labels in bar mode
                        bar: {
                            borderColor: '#1f2937',
                            dataLabels: { enabled: true, align: 'right', color: '#d1d5db', style: { textOutline: 'none', fontWeight: 'normal', fontSize: '10px' }, format: '{point.y}', inside: false },
                            showInLegend: false,
                            // Click handler is already defined above in general bar options
                        }
                    },
                    tooltip: { pointFormat: '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)' },
                    // Use existing data structure, Highcharts maps it
                    series: [{ name: 'Films', type: 'bar', data: currentDonutChartData as any[] }] // Cast as any kept
                } as any // Cast as any kept
            }]
        };

        return options;

    }, [currentDonutChartData, currentDonutChartTitle, handlePieSliceClick]); // Add handlePieSliceClick dependency

    // --- Interval Chart Click Handler (unchanged) ---
    const handleIntervalClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any; const intervalIndex = point.intervalIndex;
        if (typeof intervalIndex === 'number' && intervalIndex > 0 && intervalIndex < watchedFilmsSorted.length) {
            const startDate = new Date(point.startDate); const endDate = new Date(point.endDate); const days = point.y;
            // Ensure we only include films STRICTLY between start (exclusive) and end (inclusive) of the interval
            const filmsInInterval = watchedFilmsSorted.filter(film => film.parsedWatchDate.getTime() > startDate.getTime() && film.parsedWatchDate.getTime() <= endDate.getTime());
            setSelectedIntervalDetail({ startDate, endDate, days, films: filmsInInterval });
        } else { setSelectedIntervalDetail(null); }
    }, [watchedFilmsSorted]);

    // --- Interval Chart Options (unchanged) ---
    const meetingIntervalChartOptions = useMemo((): Highcharts.Options => ({
        chart: { type: 'column', backgroundColor: '', style: { fontFamily: 'Inter, sans-serif' } },
        title: { text: 'Time Between Club Meetings', style: { color: '#d1d5db' } },
        xAxis: { categories: meetingIntervalCategories, labels: { rotation: -45, style: { color: '#9ca3af', fontSize: '10px' } }, lineColor: '#4b5563', tickColor: '#4b5563' },
        yAxis: { min: 0, title: { text: 'Days Since Last Meeting', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
        legend: { enabled: false },
        tooltip: { pointFormat: '<b>{point.y} days</b><br/>Up to meeting for: {point.category}', backgroundColor: 'rgba(31, 41, 55, 0.9)', borderColor: '#4b5563', style: { color: '#f3f4f6' } },
        plotOptions: { column: { pointPadding: 0.1, borderWidth: 0, color: '#10b981', pointWidth: 15, groupPadding: 0.1 }, series: { cursor: 'pointer', point: { events: { click: handleIntervalClick } } } },
        series: [{ name: 'Days Between Meetings', type: 'column', data: meetingIntervalData as any[] }], // Cast as any kept
        credits: { enabled: false }
    }), [meetingIntervalData, meetingIntervalCategories, handleIntervalClick]);

    // --- Helper to get highlight class (unchanged) ---
    const getHighlightClass = (highlight: MemberStatHighlight): string => {
        if (highlight === 'high') return 'text-emerald-400 font-semibold';
        if (highlight === 'low') return 'text-yellow-400 font-semibold';
        return 'text-slate-100';
    };

    // --- Dynamic Title for Filtered Film List ---
    const filteredListTitle = useMemo(() => {
        if (!selectedPieSliceName) return '';
        switch (selectedCategory) {
            case 'country': return `Films from ${selectedPieSliceName}`;
            case 'language': return `Films in ${selectedPieSliceName}`;
            case 'decade': return `Films Released in the ${selectedPieSliceName}`;
            default: return 'Selected Films';
        }
    }, [selectedCategory, selectedPieSliceName]);


    // --- Render Logic ---
    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 !pt-6 text-slate-200">
            <div className="!text-2xl sm:text-4xl font-bold text-slate-300 mb-10 text-center border-b border-slate-700 pb-4">
                Almanac
            </div>

            {/* General Stats Section (unchanged) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Watch Time</p>
                    <p className="font-mono text-slate-100 tracking-tight text-lg sm:text-xl md:text-2xl">{totalRuntimeString || "..."}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Across {watchedFilmsCount} watched films.</p>
                </div>
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Films Logged</p>
                    <p className="font-mono text-slate-100 tracking-tight text-lg sm:text-xl md:text-2xl">{totalFilmsCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Watched & upcoming.</p>
                </div>
            </div>

            {/* Donut/Bar Chart Section */}
            <div className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-4"> {/* Reduced bottom margin */}
                {/* Category buttons (unchanged) */}
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 border-b border-slate-600 pb-3">
                    {(['country', 'language', 'decade'] as ChartCategory[]).map(category => (
                        <button key={category} onClick={() => {
                            setSelectedCategory(category);
                            setSelectedPieSliceName(null); // <-- Reset selection when changing category
                            setFilteredFilmsForPieSlice([]); // <-- Reset selection when changing category
                        }}
                            className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ease-out whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-emerald-500 ${selectedCategory === category ? 'bg-emerald-600 text-white shadow-md' : ' text-slate-300 hover:bg-slate-600 hover:text-white'}`}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                        </button>
                    ))}
                </div>
                {/* Chart Render (unchanged) */}
                {countryChartData.length > 0 || languageChartData.length > 0 || decadeChartData.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={donutChartOptions} />
                ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading chart...</div>)}
            </div>

            {/* --- NEW: Filtered Film List Section --- */}
            {selectedPieSliceName && (
                <div className="bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 mb-8 sm:mb-10 mt-4 animate-fade-in"> {/* Added fade-in animation (requires defining in tailwind.config.js or global css) */}
                    <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        {/* <h3 className="text-base sm:text-lg font-semibold text-emerald-400">
                            {filteredListTitle} ({filteredFilmsForPieSlice.length})
                        </h3> */}
                        <button
                            onClick={() => {
                                setSelectedPieSliceName(null);
                                setFilteredFilmsForPieSlice([]);
                            }}
                            className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-0.5 !px-2 !py-1 transition-colors"
                            aria-label="Close film list"
                        >
                            &times;
                        </button>
                    </div>
                    {selectedPieSliceName && (
                        <div className="bg-slate-800 rounded-lg p-4 shadow-lg  border-slate-600 mb-0 sm:mb-0 mt-4 animate-fade-in">
                            <div className="flex justify-between items-center mb-0">
                                {/* ... Title and Close Button ... */}
                            </div>
                            {filteredFilmsForPieSlice.length > 0 ? (
                                <div> {/* Wrapper can just be simple now */}
                                    <FilmList
                                        films={filteredFilmsForPieSlice}
                                        title={`${filteredListTitle} (${filteredFilmsForPieSlice.length})`} // Title handled above
                                        hideSizeButtons={true} // Hide size buttons for this list
                                        layoutMode='horizontal' 
                                    // No onFilmSelect needed unless clicking these should do something else
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic text-center py-4">No films found for this selection.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* --- End Filtered Film List Section --- */}


            {/* Interval Chart Section (unchanged structure) */}
            <div className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-8 sm:mb-10">
                {meetingIntervalData.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={meetingIntervalChartOptions} />
                ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading intervals...</div>)}
                {selectedIntervalDetail && (
                    <div className="mt-4 p-3 bg-transparent rounded-md border border-slate-600">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold text-slate-400">Films Watched ({selectedIntervalDetail.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {selectedIntervalDetail.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</h4>
                            <button onClick={() => setSelectedIntervalDetail(null)} className="text-xs text-slate-400 hover:text-white !px-2 !py-1">&times;</button>
                        </div>
                        {selectedIntervalDetail.films.length > 0 ? (<ul className="list-disc list-inside text-xs space-y-1 text-slate-300 max-h-32 overflow-y-auto pr-2">{(selectedIntervalDetail.films as FilmWithDate[]).map(film => (<li key={film.imdbID}>{film.title} ({film.year}) - Watched {film.parsedWatchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</li>))}</ul>) : (<p className="text-xs text-slate-400 italic">No films recorded in this specific interval.</p>)}
                    </div>
                )}
            </div>

            {/* User Stats Section - Grid Layout (unchanged structure) */}
            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">Member Stats Breakdown</h3>
                {allMemberStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {allMemberStats.map(({ member, stats, highlights }) => (
                            <div key={member.name} className="bg-gray-800 rounded-lg p-4 shadow-lg border border-slate-600 flex flex-col">
                                {/* Member Header */}
                                <div className="flex items-center mb-4 border-b border-slate-700 pb-3">
                                    <CircularImage alt={member.name} size="w-10 h-10 sm:w-12 sm:h-12" className="border-2 border-slate-600 mr-3" />
                                    <h4 className="text-base sm:text-lg font-semibold text-slate-100">{member.name}</h4>
                                </div>
                                {/* Stats List */}
                                <div className="space-y-2 text-sm flex-grow">
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Selections Made:</span><span className="text-slate-100 font-medium">{stats.selectionCount}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Runtime (Sel.):</span><span className={getHighlightClass(highlights.avgSelectionRuntime)}>{stats.avgSelectionRuntime ? `${Math.round(stats.avgSelectionRuntime)} min` : 'N/A'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Club Score (Sel.):</span><span className={getHighlightClass(highlights.avgSelectionScore)}>{formatAverage(stats.avgSelectionScore)} / 9</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Score Given:</span><span className={getHighlightClass(highlights.avgGivenScore)}>{formatAverage(stats.avgGivenScore)} / 9</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Unique Countries (Sel.):</span><span className={getHighlightClass(highlights.selectionCountryCount)}>{stats.selectionCountryCount}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Year (Sel.):</span><span className={getHighlightClass(highlights.avgSelectionYear)}>{formatYear(stats.avgSelectionYear)}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-sm text-slate-400 italic py-4">Calculating member stats...</p>)}
            </div>

        </div> // End Main Container
    );
};

export default AlmanacPage;

