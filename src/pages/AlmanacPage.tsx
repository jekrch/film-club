import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Link } from 'react-router-dom';
import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import StatCard from '../components/almanac/StatCard';
import ChartContainer from '../components/almanac/ChartContainer';
import CategorySelector from '../components/almanac/CategorySelector';
import FilteredFilmListSection from '../components/almanac/FilteredFilmSection';
import IntervalDetailDisplay from '../components/almanac/IntervalDetailDisplay';
import MemberStatCard from '../components/almanac/MemberStatCard';
import CreditsModal from '../components/common/CreditsModal';
import {
    parseRuntime,
    formatAverage as formatAverageUtil,
    calculateMemberStats,
    ComprehensiveMemberStats,
    MemberStatHighlight
} from '../utils/statUtils';

// @ts-ignore
import 'swiper/css';
// @ts-ignore
import 'swiper/css/free-mode';
// @ts-ignore
import 'swiper/css/scrollbar';

import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Scrollbar, Mousewheel } from 'swiper/modules';

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
    const formatted = formatAverageUtil(avg, digits);
    return formatted === null ? 'N/A' : formatted;
};
const formatYear = (year: number | null | undefined): string => {
    if (year === null || year === undefined || isNaN(year)) return 'N/A';
    return Math.round(year).toString();
};

interface PersonCredit {
    film: Film;
    roles: string[];
}
const getAllFilmCreditsForPerson = (personName: string, allFilms: Film[]): PersonCredit[] => {
    const credits: PersonCredit[] = [];
    const trimmedPersonName = personName.trim().toLowerCase();
    if (!trimmedPersonName) return credits;

    allFilms.forEach(f => {
        const rolesForFilm: string[] = [];
        const checkCreditField = (creditField: string | undefined, roleName: string) => {
            if (creditField && typeof creditField === 'string' && creditField.toLowerCase().split(',').map(n => n.trim()).includes(trimmedPersonName)) {
                rolesForFilm.push(roleName);
            }
        };

        checkCreditField(f.director, 'Director');
        checkCreditField(f.writer, 'Writer');
        checkCreditField(f.actors, 'Actor');
        checkCreditField(f.cinematographer, 'Cinematographer');
        checkCreditField(f.editor, 'Editor');
        checkCreditField(f.productionDesigner, 'Production Designer');
        checkCreditField(f.musicComposer, 'Music Composer');
        checkCreditField(f.costumeDesigner, 'Costume Designer');

        if (rolesForFilm.length > 0) {
            credits.push({ film: f, roles: rolesForFilm });
        }
    });
     // Sort by year descending, then title ascending
    credits.sort((a, b) => {
        const yearA = parseInt(a.film.year, 10) || 0;
        const yearB = parseInt(b.film.year, 10) || 0;
        if (yearB !== yearA) {
            return yearB - yearA;
        }
        return a.film.title.localeCompare(b.film.title);
    });
    return credits;
};


export type ChartCategory = 'country' | 'language' | 'decade';
type FilmWithDate = Film & { parsedWatchDate: Date };
interface IntervalDetail {
    startDate: Date; endDate: Date; days: number; films: FilmWithDate[];
}
export interface MemberStatsData {
    member: TeamMember;
    stats: ComprehensiveMemberStats;
    highlights: {
        avgRuntime: MemberStatHighlight;
        avgSelectedScore: MemberStatHighlight;
        avgGivenScore: MemberStatHighlight;
        selectionCountryCount: MemberStatHighlight;
        avgSelectionYear: MemberStatHighlight;
    };
}

interface FrequentPersonData {
    name: string;
    count: number;
    filmography: PersonCredit[];
}

const AlmanacPage: React.FC = () => {
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [totalFilmsCount, setTotalFilmsCount] = useState<number>(0);
    const [watchedFilmsCount, setWatchedFilmsCount] = useState<number>(0);
    const [allFilmsData, setAllFilmsData] = useState<Film[]>([]);
    const [watchedFilmsSorted, setWatchedFilmsSorted] = useState<FilmWithDate[]>([]);
    const [foundingDate, setFoundingDate] = useState<Date | null>(null);
    const [daysActive, setDaysActive] = useState<number | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('country');
    const [countryChartData, setCountryChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [languageChartData, setLanguageChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [decadeChartData, setDecadeChartData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [selectedPieSliceName, setSelectedPieSliceName] = useState<string | null>(null);
    const [filteredFilmsForPieSlice, setFilteredFilmsForPieSlice] = useState<Film[]>([]);

    const [meetingIntervalData, setMeetingIntervalData] = useState<Highcharts.PointOptionsObject[]>([]);
    const [meetingIntervalCategories, setMeetingIntervalCategories] = useState<string[]>([]);
    const [selectedIntervalDetail, setSelectedIntervalDetail] = useState<IntervalDetail | null>(null);

    const [allMemberStats, setAllMemberStats] = useState<MemberStatsData[]>([]);
    const [frequentPersons, setFrequentPersons] = useState<FrequentPersonData[]>([]);
    const [creditsModalState, setCreditsModalState] = useState<{
        isOpen: boolean;
        personName: string | null;
        filmography: PersonCredit[] | null;
    }>({ isOpen: false, personName: null, filmography: null });

    const filmListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const films = filmData;
        setAllFilmsData(films);
        setTotalFilmsCount(films.length);

        const watchedWithDates = films.map(f => ({ ...f, pDate: parseWatchDate(f.movieClubInfo?.watchDate) })).filter(f => f.pDate) as (Film & { pDate: Date })[];
        const sortedWatched = watchedWithDates.sort((a, b) => a.pDate.getTime() - b.pDate.getTime());
        const finalSortedWatched: FilmWithDate[] = sortedWatched.map(({ pDate, ...rest }) => ({ ...rest, parsedWatchDate: pDate }));
        setWatchedFilmsSorted(finalSortedWatched);
        setWatchedFilmsCount(finalSortedWatched.length);

        if (finalSortedWatched.length > 0) {
            const firstDate = finalSortedWatched[0].parsedWatchDate;
            setFoundingDate(firstDate);
            const today = new Date();
            setDaysActive(daysBetween(firstDate, today));
        } else {
            setFoundingDate(null);
            setDaysActive(null);
        }

        const totalMinutes = finalSortedWatched.reduce((sum, film) => {
            const rt = parseRuntime(film.runtime);
            if (rt !== null) return sum + rt;
            return sum;
        }, 0);
        setTotalRuntimeString(formatTotalMinutes(totalMinutes));

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
                    intervalIndex: i,
                    startDate: date1.getTime(),
                    endDate: date2.getTime(),
                    category: finalSortedWatched[i].title
                } as any);
            }
        }
        setMeetingIntervalData(intervals);
        setMeetingIntervalCategories(intervalCategories);

        const active = (teamMembersData as TeamMember[]).filter(m => typeof m.queue === 'number' && m.queue > 0).sort((a, b) => (a.queue ?? Infinity) - (b.queue ?? Infinity));
        const memberStatsList = active.map(member => ({
            member,
            stats: calculateMemberStats(member.name, films)
        }));

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
            avgRuntime: findHighLow('avgRuntime'),
            avgSelectedScore: findHighLow('avgSelectedScore'),
            avgGivenScore: findHighLow('avgGivenScore'),
            selectionCountryCount: findHighLow('selectionCountryCount'),
            avgSelectionYear: findHighLow('avgSelectionYear'),
        };

        const finalStatsData: MemberStatsData[] = memberStatsList.map(({ member, stats }) => {
            const getHighlight = (statKey: keyof MemberStatsData['highlights'], value: number | null): MemberStatHighlight => {
                if (value === null || typeof value !== 'number' || isNaN(value)) return null;
                let lookupKey: keyof ComprehensiveMemberStats | undefined = undefined;
                switch (statKey) {
                    case 'avgRuntime': lookupKey = 'avgRuntime'; break;
                    case 'avgSelectedScore': lookupKey = 'avgSelectedScore'; break;
                    case 'avgGivenScore': lookupKey = 'avgGivenScore'; break;
                    case 'selectionCountryCount': lookupKey = 'selectionCountryCount'; break;
                    case 'avgSelectionYear': lookupKey = 'avgSelectionYear'; break;
                    default: return null;
                }
                const { high, low } = (highlightsMap as any)[statKey];
                const isHigh = high !== null && value === high && high !== low;
                const isLow = low !== null && value === low && high !== low;
                if (statKey === 'selectionCountryCount' && isLow) return null;
                if (isHigh) return 'high';
                if (isLow) return 'low';
                return null;
            };
            return {
                member, stats, highlights: {
                    avgRuntime: getHighlight('avgRuntime', stats.avgRuntime),
                    avgSelectedScore: getHighlight('avgSelectedScore', stats.avgSelectedScore),
                    avgGivenScore: getHighlight('avgGivenScore', stats.avgGivenScore),
                    selectionCountryCount: getHighlight('selectionCountryCount', stats.selectionCountryCount),
                    avgSelectionYear: getHighlight('avgSelectionYear', stats.avgSelectionYear),
                }
            };
        });
        setAllMemberStats(finalStatsData);

        const personCounts: Record<string, { count: number; filmography: PersonCredit[] }> = {};
        const creditFields: (keyof Film)[] = ['director', 'writer', 'actors', 'cinematographer', 'editor', 'productionDesigner', 'musicComposer', 'costumeDesigner'];

        films.forEach(film => {
            const personsInThisFilm = new Set<string>();
            creditFields.forEach(field => {
                const creditString = film[field] as string | undefined;
                if (creditString && typeof creditString === 'string' && creditString !== "N/A") {
                    creditString.split(',').map(name => name.trim()).filter(name => name).forEach(name => {
                        personsInThisFilm.add(name);
                    });
                }
            });

            personsInThisFilm.forEach(personName => {
                if (!personCounts[personName]) {
                    personCounts[personName] = { count: 0, filmography: getAllFilmCreditsForPerson(personName, films) };
                }
                personCounts[personName].count++;
            });
        });

        const sortedPersons = Object.entries(personCounts)
            .map(([name, data]) => ({ name, ...data }))
            .filter(p => p.count > 1)
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, 6);

        setFrequentPersons(sortedPersons);

    }, []);

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
    }, [selectedCategory, allFilmsData, selectedPieSliceName]);

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
                bar: {
                    point: { events: { click: function () { handleCategoryClick(this); } } }
                },
            },
            series: [{ name: 'Films', colorByPoint: true, type: 'pie', data: currentDonutChartData as any[] } as any],
            credits: { enabled: false },
            colors: ['#b76e41', '#d9a534', '#1a7b6d', '#be5a38', '#6b7da3', '#a34a6a', '#2c815c', '#c88b3a', '#734f8c', '#b35450', '#a87c5f', '#d3a064', '#5f7464', '#946b54', '#7c6a53', '#85594c', '#4e6e81', '#8f4e5b', '#5c6e58', '#8d7471']
        };

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
                        column: { pointPadding: 0.1, borderWidth: 0, color: '#1a7b6d', pointWidth: 15, groupPadding: 0.1 },
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
                        }
                    },
                    tooltip: { pointFormat: '{series.name}: <b>{point.y}</b> ({point.percentage:.1f}%)' },
                    series: [{ name: 'Films', type: 'bar', data: currentDonutChartData as any[] }]
                } as Highcharts.Options
            }]
        };
        return options;
    }, [currentDonutChartData, currentDonutChartTitle, handleCategoryClick]);

    const handleIntervalClick = useCallback((event: Highcharts.PointClickEventObject) => {
        const point = event.point as any;
        const intervalIndex = point.intervalIndex;
        if (typeof intervalIndex === 'number' && intervalIndex >= 1 && intervalIndex < watchedFilmsSorted.length) {
            const startDate = new Date(point.startDate);
            const endDate = new Date(point.endDate);
            const days = point.y;
            const filmsInInterval = watchedFilmsSorted.slice(intervalIndex, intervalIndex + 1);
            setSelectedIntervalDetail({ startDate, endDate, days, films: filmsInInterval });
        } else {
            setSelectedIntervalDetail(null);
            console.warn("Invalid interval data or click target:", point);
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
                const point = this.points as any;
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

    const getHighlightClass = useCallback((highlight: MemberStatHighlight): string => {
        if (highlight === 'high') return 'text-emerald-400 font-semibold';
        if (highlight === 'low') return 'text-blue-400 font-semibold';
        return 'text-slate-100 font-medium';
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

    const handleCategorySelected = useCallback((category: ChartCategory) => {
        setSelectedCategory(category);
        setSelectedPieSliceName(null);
        setFilteredFilmsForPieSlice([]);
    }, []);

    const closeFilteredList = useCallback(() => {
        setSelectedPieSliceName(null);
        setFilteredFilmsForPieSlice([]);
    }, []);

    const closeIntervalDetail = useCallback(() => {
        setSelectedIntervalDetail(null);
    }, []);

    const handleFrequentPersonClick = (personName: string, filmography: PersonCredit[]) => {
        setCreditsModalState({
            isOpen: true,
            personName: personName,
            filmography: filmography,
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 !pt-6 text-slate-200">
            {creditsModalState.isOpen && (
                <CreditsModal
                    isOpen={creditsModalState.isOpen}
                    onClose={() => setCreditsModalState({ isOpen: false, personName: null, filmography: null })}
                    personName={creditsModalState.personName}
                    filmography={creditsModalState.filmography}
                />
            )}

            <div className="!text-2xl sm:text-4xl font-bold text-slate-300 text-center border-b border-slate-700 pb-4">
                Almanac
            </div>

            {foundingDate && daysActive !== null && (
                <div className="text-center mb-6 mt-3 text-slate-400 border-b border-slate-700 pb-3">
                    <p className="text-sm sm:text-base">
                        Founded on <span className="font-semibold text-slate-300">{foundingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
                        <div className="text-xs mt-1">Active <span className="text-slate-200">{daysActive.toLocaleString()}</span> days</div>
                    </p>
                </div>
            )}

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
                                    selectionCountryCount: stats.selectionCountryCount,
                                    avgSelectionYear: stats.avgSelectionYear,
                                } as any}
                                highlights={highlights as any}
                                formatAverage={formatAverage}
                                formatYear={formatYear}
                                getHighlightClass={getHighlightClass as any}
                            />
                        ))}
                    </div>
                ) : (<p className="text-center text-sm text-slate-400 italic py-4">Calculating member stats...</p>)}
            </div>

            {/* Most Frequently Appearing Persons Section - Updated Layout */}
            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-8 text-slate-100">Most Frequently Appearing Persons</h3>
                {frequentPersons.length > 0 ? (
                    <div className="space-y-8">
                        {frequentPersons.map((person) => (
                            <div key={person.name} className="bg-slate-800 rounded-lg p-4 md:p-6 shadow-xl border border-slate-700 flex flex-colx md:flex-rowx gap-4 md:gap-6x">
                                {/* Left Column: Text Info */}
                                <div className="md:w-2/5 lg:w-1/3 flex-shrink-0">
                                    <div className="flex justify-between items-center mb-3 border-b border-slate-600 pb-2">
                                        <h4
                                            className="text-lg font-semibold text-blue-400 hover:text-blue-300 cursor-pointer truncate"
                                            onClick={() => handleFrequentPersonClick(person.name, person.filmography)}
                                            title={`View all credits for ${person.name}`}
                                        >
                                            {person.name}
                                        </h4>
                                        <span className="text-sm text-slate-400 whitespace-nowrap ml-2">({person.count} films)</span>
                                    </div>
                                    <ul className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700">
                                        {person.filmography.map(({ film, roles }) => (
                                            <li key={film.imdbID} className="text-slate-300">
                                                <Link to={`/films/${film.imdbID}`} className="hover:text-slate-100 hover:underline font-medium">
                                                    {film.title} <span className="text-slate-500">({film.year})</span>
                                                </Link>
                                                <span className="text-slate-400 text-[11px] block ml-2">- {roles.join(', ')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                     {person.filmography.length > 7 && ( // Example: show button if more than 7 initial items
                                         <div className="text-center mt-2">
                                             <button
                                                 onClick={() => handleFrequentPersonClick(person.name, person.filmography)}
                                                 className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                             >
                                                 View all credits in modal...
                                             </button>
                                         </div>
                                    )}
                                </div>

                                {/* Right Column: Horizontally Scrollable Posters */}
                                <div className="md:w-3/5 lg:w-2/3 flex-grow min-w-0">
                                    {person.filmography.length > 0 ? (
                                    <Swiper
                                        modules={[FreeMode, Scrollbar, Mousewheel]}
                                        slidesPerView="auto"
                                        spaceBetween={12} // Tailwind space-x-3
                                        freeMode={true}
                                        scrollbar={{ draggable: true, hide: false, el: `.swiper-scrollbar-${person.name.replace(/\s+/g, '-')}` }}
                                        mousewheel={true}
                                        className="h-full pb-5 frequent-persons-swiper" // Added specific class
                                    >
                                        {person.filmography.map(({ film }) => (
                                            <SwiperSlide key={film.imdbID} className="!w-[100px] group" > {/* Adjust width as needed, e.g., !w-24 or !w-28 */}
                                                <Link to={`/films/${film.imdbID}`} className="block h-full rounded-md overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                                                    <img
                                                        src={film.poster !== "N/A" ? film.poster : '/placeholder-poster.png'}
                                                        alt={`Poster for ${film.title}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                        onError={(e) => { e.currentTarget.src = '/placeholder-poster.png'; }}
                                                    />
                                                </Link>
                                                <p className="mt-1 text-[10px] text-slate-300 truncate text-center group-hover:text-blue-400" title={film.title}>
                                                    {film.title}
                                                </p>
                                            </SwiperSlide>
                                        ))}
                                    </Swiper>
                                     ) : (
                                        <p className="text-xs text-slate-500 italic text-center h-full flex items-center justify-center">No film posters to display.</p>
                                    )}
                                     {/* Custom scrollbar element, ensuring unique class */}
                                    <div className={`swiper-scrollbar swiper-scrollbar-${person.name.replace(/\s+/g, '-')} mt-2`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-slate-400 italic py-4">
                        No persons found appearing in multiple films yet.
                    </p>
                )}
            </div>


        </div>
    );
};

export default AlmanacPage;