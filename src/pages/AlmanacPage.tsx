import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// --- Data & Types ---
// NOTE: Adjust these import paths based on your project structure
import { Film } from '../types/film'; // Adjust path as needed
import { TeamMember, teamMembers as teamMembersData } from '../types/team'; // Adjust path as needed
import filmsData from '../assets/films.json'; // Adjust path as needed

// --- Components ---
import CircularImage from '../components/common/CircularImage'; // Adjust path as needed
import FilmList from '../components/films/FilmList'; // Adjust path as needed

// --- Utils ---
import { calculateClubAverage } from '../utils/ratingUtils'; // Adjust path as needed
import { Link } from 'react-router-dom';

// --- Helper Functions (Keep or move to utils - Unchanged) ---
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
    if (avg === null || avg === undefined || isNaN(avg)) return 'N/A';
    return avg.toFixed(digits);
};
const formatYear = (year: number | null | undefined): string => {
    if (year === null || year === undefined || isNaN(year)) return 'N/A';
    return Math.round(year).toString();
};

// --- NEW Helper Function ---
/**
 * Counts the number of valid (non-null, numeric) ratings in a club ratings object.
 * @param clubRatings - The object containing member ratings.
 * @returns The count of valid ratings.
 */
const countValidRatings = (clubRatings: Record<string, number | null> | undefined): number => {
    if (!clubRatings) return 0;
    return Object.values(clubRatings).filter(rating => typeof rating === 'number' && !isNaN(rating)).length;
};

// --- Types (unchanged) ---
type ChartCategory = 'country' | 'language' | 'decade';
type FilmWithDate = Film & { parsedWatchDate: Date };
interface UserStats {
    selectionCount: number;
    avgSelectionRuntime: number | null;
    avgSelectionScore: number | null; // Average score of films selected BY this user (where film has 2+ ratings)
    avgGivenScore: number | null;      // Average score GIVEN BY this user
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
    // General Stats State (unchanged)
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [totalFilmsCount, setTotalFilmsCount] = useState<number>(0);
    const [watchedFilmsCount, setWatchedFilmsCount] = useState<number>(0);
    const [allFilmsData, setAllFilmsData] = useState<Film[]>([]);
    const [watchedFilmsSorted, setWatchedFilmsSorted] = useState<FilmWithDate[]>([]);
    const [foundingDate, setFoundingDate] = useState<Date | null>(null);
    const [daysActive, setDaysActive] = useState<number | null>(null);

    // Donut Chart State (unchanged)
    const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('country');
    const [countryChartData, setCountryChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [languageChartData, setLanguageChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [decadeChartData, setDecadeChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [selectedPieSliceName, setSelectedPieSliceName] = useState<string | null>(null);
    const [filteredFilmsForPieSlice, setFilteredFilmsForPieSlice] = useState<Film[]>([]);

    // Interval Chart State (unchanged, data structure remains the same)
    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(null);

    // User Stats State (unchanged)
    const [allMemberStats, setAllMemberStats] = useState<MemberStatsData[]>([]);

    // --- NEW: Ref for the filtered film list container (unchanged) ---
    const filmListRef = useRef<HTMLDivElement>(null);

    // --- Stat Calculation Function (for one user - UPDATED) ---
    const calculateUserStats = useCallback((userName: string, films: Film[]): UserStats => {
        const userSelections = films.filter(film => film.movieClubInfo?.selector === userName);
        const selectionCount = userSelections.length;

        // Avg Runtime (Unchanged)
        let totalRuntime = 0; let runtimeCount = 0;
        userSelections.forEach(film => {
            if (film?.runtime && typeof film.runtime === 'string') {
                const minutes = parseInt(film.runtime.replace(/[^0-9]/g, ''), 10);
                if (!isNaN(minutes)) { totalRuntime += minutes; runtimeCount++; }
            }
        });
        const avgSelectionRuntime = runtimeCount > 0 ? totalRuntime / runtimeCount : null;

        // Avg Selection Score (UPDATED LOGIC)
        let totalSelectionScore = 0; let selectionScoreCount = 0;
        userSelections.forEach(film => {
            // Check if the film has at least 2 valid ratings FIRST
            const validRatingCount = countValidRatings(film.movieClubInfo?.clubRatings as any);

            if (validRatingCount >= 2) {
                // Only calculate and use the average if the rating count threshold is met
                const avg = calculateClubAverage(film.movieClubInfo?.clubRatings);
                if (avg !== null && !isNaN(avg)) {
                    totalSelectionScore += avg;
                    selectionScoreCount++; // Only increment count for films meeting the criteria
                }
            }
        });
        // Calculate average based only on films that met the criteria
        const avgSelectionScore = selectionScoreCount > 0 ? totalSelectionScore / selectionScoreCount : null;

        // Normalize userName for consistent access to clubRatings keys (Unchanged)
        const normalizedUserName = userName.toLowerCase();

        // Avg Given Score (Unchanged)
        let totalGivenScore = 0; let givenScoreCount = 0;
        films.forEach(film => {
            const ratings = film.movieClubInfo?.clubRatings;
            // Use normalizedUserName to access the rating property
            if (ratings && Object.prototype.hasOwnProperty.call(ratings, normalizedUserName)) {
                // Access the rating using the normalized key
                const rating = ratings[normalizedUserName as keyof typeof ratings];
                if (rating !== null && rating !== undefined) {
                    const numericRating = Number(rating);
                    if (!isNaN(numericRating)) {
                        totalGivenScore += numericRating;
                        givenScoreCount++;
                    }
                }
            }
        });
        const avgGivenScore = givenScoreCount > 0 ? totalGivenScore / givenScoreCount : null;

        // Selection Country Count (Unchanged)
        const countries = new Set<string>();
        userSelections.forEach(film => {
            if (film?.country?.trim() && film.country !== "N/A") {
                countries.add(film.country.split(',')[0].trim());
            }
        });
        const selectionCountryCount = countries.size;

        // Avg Selection Year (Unchanged)
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
    }, []); // Empty dependency array as it doesn't rely on component state/props directly


    // --- Main Data Processing & Stats Calculation Effect (unchanged) ---
    useEffect(() => {
        const films = filmsData as unknown as Film[];
        setAllFilmsData(films);
        setTotalFilmsCount(films.length);

        // Process watched films
        const watchedWithDates = films.map(f => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) })).filter(f => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort((a, b) => a.pDate.getTime() - b.pDate.getTime());
        const finalSortedWatched = sortedWatched.map(({ pDate, ...rest }) => ({ ...rest, parsedWatchDate: pDate }));
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

        // Process Interval Chart Data (unchanged, data structure is fine for line)
        const intervals: Highcharts.PointOptionsObject[] = [];
        const intervalCategories: string[] = [];
        if (finalSortedWatched.length > 1) {
            for (let i = 1; i < finalSortedWatched.length; i++) {
                const date1 = finalSortedWatched[i - 1].parsedWatchDate;
                const date2 = finalSortedWatched[i].parsedWatchDate;
                const intervalDays = daysBetween(date1, date2);
                // Use date2 for the category label (meeting date)
                const categoryLabel = date2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                intervalCategories.push(`${categoryLabel}`); // e.g., "Apr 27, '25"
                // Store interval details on the point for click events
                intervals.push({
                    y: intervalDays,
                    intervalIndex: i,
                    startDate: date1.getTime(), // Store as ms since epoch
                    endDate: date2.getTime(),
                    category: finalSortedWatched[i].title // Store film title for tooltip (used in formatter)
                } as any);
            }
        }
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);

        // Process Team Members & Calculate All Stats + Highlights
        const active = (teamMembersData as TeamMember[]).filter(m => typeof m.queue === 'number' && m.queue > 0).sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
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
            // Only return high/low if at least 2 members have a valid stat
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
                // Check if the value matches the high/low and ensure high/low are distinct
                const isHigh = high !== null && value === high && high !== low;
                const isLow = low !== null && value === low && high !== low;

                // Prevent 'low' highlight for country count
                if (statKey === 'selectionCountryCount' && isLow) {
                    return null;
                }

                if (isHigh) return 'high';
                if (isLow) return 'low';
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

    }, [calculateUserStats]); // Include calculateUserStats here

    // --- Chart Options (unchanged) ---
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

    // --- Pie Slice/Label/Bar/Bar Label Click Handler (consolidated logic - unchanged) ---
    const handleCategoryClick = useCallback((point: Highcharts.Point) => {
        const sliceName = point.name;
        const isDeselecting = sliceName === selectedPieSliceName;

        if (isDeselecting) {
            setSelectedPieSliceName(null);
            setFilteredFilmsForPieSlice([]);
            return; // No need to filter or scroll if deselecting
        }

        // Filter films based on the clicked category
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

        // Update state for the filter
        setSelectedPieSliceName(sliceName);
        setFilteredFilmsForPieSlice(filtered);

        // Scroll logic is handled by the useEffect below
    }, [selectedCategory, allFilmsData, selectedPieSliceName]); // Dependencies

    // --- NEW: Effect to scroll to the film list when it appears (unchanged) ---
    useEffect(() => {
        // Only scroll if a slice/bar *is* selected and the ref is attached
        if (selectedPieSliceName && filmListRef.current) {
            filmListRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest' // Scrolls the minimum amount to bring the element into view
            });
        }
    }, [selectedPieSliceName]); // Re-run only when the selected slice changes

    // --- Donut/Bar Chart Options (with unified click handler - unchanged) ---
    const donutChartOptions = useMemo((): Highcharts.Options => {
        // Height calculation for responsive bar chart (unchanged)
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

        // Base options
        const options: Highcharts.Options = {
            chart: { type: 'pie', backgroundColor: '', style: { fontFamily: 'Inter, sans-serif' } },
            title: { text: currentDonutChartTitle, style: { color: '#d1d5db' } },
            tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b> ({point.y} film{point.plural})', backgroundColor: 'rgba(31, 41, 55, 0.9)', borderColor: '#4b5563', style: { color: '#f3f4f6' } },
            accessibility: { point: { valueSuffix: '%' } },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    borderColor: '#374151',
                    innerSize: '60%',
                    size: '90%',
                    dataLabels: {
                        enabled: true,
                        format: '{point.name}: {point.percentage:.1f}%',
                        distance: 20,
                        style: { color: '#d1d5db', textOutline: 'none', fontWeight: 'normal', fontSize: '11px', cursor: 'pointer' }, // Added cursor pointer
                        connectorColor: '#6b7280',
                        filter: { property: 'percentage', operator: '>', value: 3 },
                        // Event handler for Pie Labels
                        events: {
                            click: function () {
                                // 'this' refers to the label context, 'this.point' is the data point
                                handleCategoryClick(this.point);
                            }
                        } as any
                    } as any,
                    showInLegend: false,
                    point: {
                        events: {
                            // Use shared handler for Pie Slices
                            click: function () {
                                // 'this' refers to the point context
                                handleCategoryClick(this);
                            }
                        }
                    }
                },
                bar: { // Base bar options (for responsive)
                    dataLabels: {
                        enabled: false // Will be enabled in responsive rule
                    },
                    point: {
                        events: {
                            // Use shared handler for Bars
                            click: function () {
                                handleCategoryClick(this);
                            }
                        }
                    }
                },
            },
            series: [{ name: 'Films', colorByPoint: true, type: 'pie', data: currentDonutChartData as any[] } as any],
            credits: { enabled: false },
            colors: [ /* ... colors unchanged ... */
                '#b76e41', '#d9a534', '#1a7b6d', '#be5a38', '#6b7da3', '#a34a6a', '#2c815c', '#c88b3a', '#734f8c', '#b35450',
                '#a87c5f', '#d3a064', '#5f7464', '#946b54', '#7c6a53', '#85594c', '#4e6e81', '#8f4e5b', '#5c6e58', '#8d7471'
            ]
        };

        // Responsive rule
        options.responsive = {
            rules: [{
                condition: { maxWidth: 640 },
                chartOptions: {
                    chart: {
                        type: 'bar',
                        height: calculatedHeight
                    },
                    xAxis: {
                        categories: numberOfCategories > 0 ? currentDonutChartData.map(d => d.name) : [],
                        title: { text: null },
                        labels: { style: { color: '#9ca3af', fontSize: '10px' } },
                        lineColor: '#4b5563', tickColor: '#4b5563',

                    },
                    yAxis: { title: { text: 'Number of Films', style: { color: '#d1d5db' } }, labels: { style: { color: '#9ca3af' } }, gridLineColor: '#374151' },
                    plotOptions: {
                        column: { /* ... column options unchanged ... */
                            pointPadding: 0.1, borderWidth: 0, color: '#1a7b6d', pointWidth: 15, groupPadding: 0.1
                        },
                        pie: { dataLabels: { enabled: false } }, // Disable pie labels in bar mode
                        bar: {
                            borderColor: '#1f2937',
                            dataLabels: {
                                enabled: true,
                                align: 'right',
                                color: '#d1d5db',
                                style: { textOutline: 'none', fontWeight: 'normal', fontSize: '10px', cursor: 'pointer' }, // Added cursor pointer
                                format: '{point.y}',
                                inside: false, // Keep labels outside the bar
                                // Event handler for Bar Labels
                                events: {
                                    click: function () {
                                        // 'this' refers to the label context, 'this.point' is the data point
                                        handleCategoryClick(this.point);
                                    }
                                } as any
                            },
                            showInLegend: false,
                            pointWidth: pointWidthForCalc,
                            // Point events already handled in base bar options
                        }
                    },
                    tooltip: { pointFormat: '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)' },
                    series: [{ name: 'Films', type: 'bar', data: currentDonutChartData as any[] }]
                } as Highcharts.Options // Type assertion
            }]
        };

        return options;

    }, [currentDonutChartData, currentDonutChartTitle, handleCategoryClick]); // Use shared handler

    // --- Interval Chart Click Handler (unchanged, works for line points too) ---
    const handleIntervalClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any; const intervalIndex = point.intervalIndex;
        // Check if intervalIndex is a valid index within watchedFilmsSorted
        if (typeof intervalIndex === 'number' && intervalIndex > 0 && intervalIndex < watchedFilmsSorted.length) {
            const startDate = new Date(point.startDate); const endDate = new Date(point.endDate); const days = point.y;
            // Find films watched *strictly after* the start date and *on or before* the end date
            // This matches the interval which represents time leading UP TO the endDate film.
            const filmsInInterval = watchedFilmsSorted.slice(intervalIndex, intervalIndex + 1); // Only the film at the end of the interval
            // Use slice to get the film at the end date index (intervalIndex corresponds to the end date's film in the sorted array)
            setSelectedIntervalDetail({ startDate, endDate, days, films: filmsInInterval });
        } else {
            // Could happen if the first point (index 0) is somehow clicked or invalid data
            setSelectedIntervalDetail(null);
            console.warn("Invalid interval click:", point);
        }
    }, [watchedFilmsSorted]);

    // --- Interval Chart Options (UPDATED to Line Chart) ---
    const meetingIntervalChartOptions = useMemo((): Highcharts.Options => ({
        chart: {
            type: 'line', // <-- CHANGED chart type
            backgroundColor: '',
            style: { fontFamily: 'Inter, sans-serif' }
        },
        title: { text: 'Time Between Club Meetings', style: { color: '#d1d5db' } },
        xAxis: {
            categories: meetingIntervalCategories,
            labels: { rotation: -45, style: { color: '#9ca3af', fontSize: '10px' } },
            lineColor: '#4b5563',
            tickColor: '#4b5563'
        },
        yAxis: {
            min: 0,
            title: { text: 'Days Since Last Meeting', style: { color: '#d1d5db' } },
            labels: { style: { color: '#9ca3af' } },
            gridLineColor: '#374151'
        },
        legend: { enabled: false },
        tooltip: {
            // Use formatter for more control, accessing custom point properties
            // This formatter still works fine for line points
            formatter: function () {
                const point = this.points as any; // Cast to access custom props
                // Display days and the film watched on the END date of the interval represented by this point
                return `<b>${point.y} days</b><br/>Interval ended on: ${point.category}<br/>Film: <i>${point.options.category}</i>`;
            },
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            borderColor: '#4b5563',
            style: { color: '#f3f4f6' }
        },
        plotOptions: {
            line: { // <-- ADDED specific line options
                lineWidth: 2,
                marker: {
                    enabled: true,
                    radius: 4,
                    fillColor: '#f3f4f6', // Example: White fill for markers
                    lineColor: '#b76e41', // Example: Use series color for marker border
                    lineWidth: 1
                },
                states: {
                    hover: {
                        lineWidth: 3
                    }
                }
            },
            // Removed column options: column: { pointPadding: 0.1, borderWidth: 0, color: '#b76e41', pointWidth: 15, groupPadding: 0.1 },
            series: { // General series options (including click)
                cursor: 'pointer',
                point: {
                    events: {
                        click: handleIntervalClick // Use the same click handler
                    }
                }
            }
        },
        series: [{
            name: 'Days Between Meetings',
            type: 'line', // <-- CHANGED series type
            color: '#b76e41', // <-- Set line color explicitly
            data: meetingIntervalData as any[]
        }],
        credits: { enabled: false }
    }), [meetingIntervalData, meetingIntervalCategories, handleIntervalClick]); // Dependencies remain the same


    // --- Helper to get highlight class (unchanged) ---
    const getHighlightClass = (highlight: MemberStatHighlight): string => {
        if (highlight === 'high') return 'text-emerald-400 font-semibold';
        if (highlight === 'low') return 'text-blue-400 font-semibold';
        return 'text-slate-100';
    };

    // --- Dynamic Title for Filtered Film List (unchanged) ---
    const filteredListTitle = useMemo(() => {
        if (!selectedPieSliceName) return '';
        switch (selectedCategory) {
            case 'country': return `Films from ${selectedPieSliceName}`;
            case 'language': return `Films in ${selectedPieSliceName}`;
            case 'decade': return `Films Released in the ${selectedPieSliceName}`;
            default: return 'Selected Films';
        }
    }, [selectedCategory, selectedPieSliceName]);


    // --- Render Logic (unchanged) ---
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
                {/* Total Watch Time */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Watch Time</p>
                    <p className="font-mono text-slate-100 tracking-tight text-lg sm:text-xl md:text-2xl">{totalRuntimeString || "..."}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Across {watchedFilmsCount} watched films.</p>
                </div>
                {/* Total Films Logged */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 shadow-lg border border-slate-600">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">Total Films Logged</p>
                    <p className="font-mono text-slate-100 tracking-tight text-lg sm:text-xl md:text-2xl">{totalFilmsCount}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Watched & upcoming.</p>
                </div>
            </div>

            {/* Donut/Bar Chart Section */}
            <div className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-4">
                {/* Category buttons */}
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 border-b border-slate-600 pb-3">
                    {(['country', 'language', 'decade'] as ChartCategory[]).map(category => (
                        <button key={category} onClick={() => {
                            setSelectedCategory(category);
                            setSelectedPieSliceName(null); // Deselect when changing category
                            setFilteredFilmsForPieSlice([]);
                        }}
                            className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ease-out whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-emerald-500 ${selectedCategory === category ? 'bg-emerald-600 text-white shadow-md' : ' text-slate-300 hover:bg-slate-600 hover:text-white'}`}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                        </button>
                    ))}
                </div>

                <p className="mb-2 text-center text-xs text-slate-400 mt-3 italic">
                    Click on a category slice, bar, or label to view the corresponding films below.
                </p>

                {/* Chart Render */}
                {countryChartData.length > 0 || languageChartData.length > 0 || decadeChartData.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={donutChartOptions} />
                ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading chart...</div>)}

            </div>

            {/* Filtered Film List Section - ADDED REF HERE */}
            {selectedPieSliceName && (
                <div ref={filmListRef} className="bg-slate-800 rounded-lg p-4 shadow-lg border border-slate-600 mb-8 sm:mb-10 mt-4 animate-fade-in">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                        {/* Title is now passed to FilmList */}
                        {/* Close Button */}
                        <button
                            onClick={() => {
                                setSelectedPieSliceName(null);
                                setFilteredFilmsForPieSlice([]);
                            }}
                            className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded px-2 py-0.5 !px-2 !py-1 transition-colors ml-auto" // Use ml-auto to push right
                            aria-label="Close film list"
                        >
                            &times;
                        </button>
                    </div>
                    {/* FilmList integration */}
                    {filteredFilmsForPieSlice.length > 0 ? (
                        <div>
                            <FilmList
                                films={filteredFilmsForPieSlice}
                                title={`${filteredListTitle} (${filteredFilmsForPieSlice.length})`}
                                hideSizeButtons={true}
                                layoutMode='horizontal'
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 italic text-center py-4">No films found for this selection.</p>
                    )}
                </div>
            )}

            {/* Interval Chart Section */}
            <div className="bg-slate-800 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-8 sm:mb-10">
                <p className="mb-2 text-center text-xs text-slate-400 italic">
                    {/* UPDATED Text for line chart */}
                    Click on a point to see which film was watched at the end of that interval.
                </p>
                {meetingIntervalData.length > 0 ? (
                    <HighchartsReact highcharts={Highcharts} options={meetingIntervalChartOptions} />
                ) : (<div className="text-center py-8 text-slate-400 text-sm">Loading intervals...</div>)}
                {selectedIntervalDetail && (
                    <div className="mt-4 p-3 bg-transparent rounded-md border border-slate-600 animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-semibold text-slate-400">
                                Interval of {selectedIntervalDetail.days} day{selectedIntervalDetail.days === 1 ? '' : 's'} ending {selectedIntervalDetail.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </h4>
                            <button
                                onClick={() => setSelectedIntervalDetail(null)}
                                className="text-lg leading-none font-bold text-slate-400 hover:text-white transition-colors !px-2 !py-0"
                                aria-label="Close interval details"
                            >
                                &times;
                            </button>
                        </div>
                        {selectedIntervalDetail.films.length > 0 ? (
                            <ul className="list-none text-xs space-y-1 text-slate-300">
                                {(selectedIntervalDetail.films as FilmWithDate[]).map(film => (
                                    <li key={film.imdbID}>
                                        Film Watched: <span className="italic font-medium text-slate-200">{film.title} ({film.year})</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-slate-400 italic">No specific film recorded for this interval endpoint.</p>
                        )}
                    </div>
                )}
            </div>

            {/* User Stats Section - Grid Layout */}
            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">Member Stats Breakdown</h3>
                {allMemberStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {allMemberStats.map(({ member, stats, highlights }) => (
                            <div key={member.name} className="bg-gray-800 rounded-lg p-4 shadow-lg border border-slate-600 flex flex-col">
                                {/* Member Header */}
                                <div className="flex items-center mb-4 border-b border-slate-700 pb-3">
                                    <Link
                                        to={`/profile/${encodeURIComponent(member.name)}`}
                                        className={`
                                            group transition-all duration-200 ease-in-out relative flex items-center                                           
                                        `}
                                        title={''}
                                    >
                                        <CircularImage alt={member.name} size="w-10 h-10 sm:w-12 sm:h-12" className="border-2 border-slate-600 mr-3" />
                                        <h4 className="text-base sm:text-lg font-semibold text-slate-300 group-hover:text-blue-400">{member.name}</h4>
                                    </Link>
                                </div>
                                {/* Stats List */}
                                <div className="space-y-2 text-sm flex-grow">
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Selections Made:</span><span className="text-slate-100 font-medium">{stats.selectionCount}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Runtime (Sel.):</span><span className={getHighlightClass(highlights.avgSelectionRuntime)}>{stats.avgSelectionRuntime ? `${Math.round(stats.avgSelectionRuntime)} min` : 'N/A'}</span></div>
                                    {/* Updated Title/Tooltip */}
                                    <div className="flex justify-between items-center" title="Average club score for films selected by this member, only including films with 2+ ratings">
                                        <span className="text-slate-400">Avg Club Score (Sel.<span className="text-xs align-super">*</span>):</span>
                                        <span className={getHighlightClass(highlights.avgSelectionScore)}>{formatAverage(stats.avgSelectionScore)} / 9</span>
                                    </div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Score Given:</span><span className={getHighlightClass(highlights.avgGivenScore)}>{formatAverage(stats.avgGivenScore)} / 9</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Unique Countries (Sel.):</span><span className={getHighlightClass(highlights.selectionCountryCount)}>{stats.selectionCountryCount}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-slate-400">Avg Year (Sel.):</span><span className={getHighlightClass(highlights.avgSelectionYear)}>{formatYear(stats.avgSelectionYear)}</span></div>
                                </div>
                                {/* Footnote Explanation */}
                                {/* {stats.avgSelectionScore !== undefined && <div className="mt-3 pt-2 border-t border-slate-700 text-xs text-slate-500">
                                     * Only includes selected films with 2+ ratings.
                                 </div>} */}
                            </div>
                        ))}
                    </div>
                ) : (<p className="text-center text-sm text-slate-400 italic py-4">Calculating member stats...</p>)}
            </div>

        </div> // End Main Container
    );
};

export default AlmanacPage;