import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import { parseWatchDate as parseWatchDateUtil } from '../utils/filmUtils'; // Renamed to avoid conflict

import { useAlmanacCharts, ChartCategory } from '../hooks/useAlmanacCharts';
import { useMemberStatistics } from '../hooks/useMemberStatistics';
import { useFrequentPersons } from '../hooks/useFrequentPersons';

import StatCard from '../components/almanac/StatCard';
import ChartContainer from '../components/almanac/ChartContainer';
import CategorySelector from '../components/almanac/CategorySelector';
import FilteredFilmListSection from '../components/almanac/FilteredFilmSection';
import IntervalDetailDisplay from '../components/almanac/IntervalDetailDisplay';
import MemberStatCard from '../components/almanac/MemberStatCard';
import CreditsModal from '../components/common/CreditsModal';
import PageLayout from '../components/layout/PageLayout';
import SectionHeader from '../components/common/SectionHeader';
import BaseCard from '../components/common/BaseCard';

import { useUnanimousScores } from '../hooks/useUnanimousScores';
import UnanimousScoresCard from '../components/almanac/UnanimousScoresCard';


// Helper Functions (can be moved to utils if not already there)
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) { return "0 days : 00 hrs : 00 m"; }
    const minutesPerDay = 1440;
    const minutesPerHour = 60;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;
    const pad = (num: number) => String(num).padStart(2, '0');
    const dayLabel = days === 1 ? 'day' : 'days';
    return `${days} ${dayLabel} : ${pad(hours)} hrs : ${pad(minutes)} m`;
};

const daysBetween = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
    const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
    return Math.floor(Math.abs(utc2 - utc1) / oneDay);
};

const AlmanacPage: React.FC = () => {
    const {
        selectedCategory,
        setSelectedCategory,
        donutChartOptions,
        selectedPieSliceName,
        filteredFilmsForPieSlice,
        closeFilteredList,
        filteredListTitle,
        filmListRef,
        meetingIntervalChartOptions,
        selectedIntervalDetail,
        closeIntervalDetail,
    } = useAlmanacCharts(filmData);

    const {
        allMemberStats,
        getHighlightClass,
        formatAverage,
        formatYear,
    } = useMemberStatistics(filmData, teamMembersData as TeamMember[]);

    const {
        frequentPersons,
        creditsModalState,
        handleFrequentPersonClick,
        closeCreditsModal,
    } = useFrequentPersons(filmData);

    // General Stats State
    const [totalRuntimeString, setTotalRuntimeString] = useState<string>('');
    const [totalFilmsCount, setTotalFilmsCount] = useState<number>(0);
    const [watchedFilmsCount, setWatchedFilmsCount] = useState<number>(0);
    const [foundingDate, setFoundingDate] = useState<Date | null>(null);
    const [daysActive, setDaysActive] = useState<number | null>(null);

    useEffect(() => {
        const films = filmData;
        setTotalFilmsCount(films.length);

        const watchedWithDates = films
            .map(f => ({ ...f, pDate: parseWatchDateUtil(f.movieClubInfo?.watchDate) }))
            .filter(f => f.pDate) as (Film & { pDate: Date })[];
        // Sort ascending by date to find the first (founding) date
        const sortedWatchedForFounding = [...watchedWithDates].sort((a, b) => a.pDate.getTime() - b.pDate.getTime());

        setWatchedFilmsCount(watchedWithDates.length);

        if (sortedWatchedForFounding.length > 0) {
            const firstDate = sortedWatchedForFounding[0].pDate;
            setFoundingDate(firstDate);
            const today = new Date();
            setDaysActive(daysBetween(firstDate, today));
        } else {
            setFoundingDate(null);
            setDaysActive(null);
        }

        const totalMinutes = watchedWithDates.reduce((sum, film) => {
            const runtimeStr = film.runtime;
            if (runtimeStr && typeof runtimeStr === 'string') {
                const rt = parseInt(runtimeStr.replace(/\D/g, ''), 10);
                if (!isNaN(rt)) return sum + rt;
            }
            return sum;
        }, 0);
        setTotalRuntimeString(formatTotalMinutes(totalMinutes));
    }, []); // Runs once on mount as filmData is static

    const handleCategorySelected = useCallback((category: ChartCategory) => {
        setSelectedCategory(category);
    }, [setSelectedCategory]);

    const {
        unanimousScores,
        totalUnanimousCount,
    } = useUnanimousScores(filmData, teamMembersData as TeamMember[]);


    return (
        <PageLayout>
            {creditsModalState.isOpen && (
                <CreditsModal
                    isOpen={creditsModalState.isOpen}
                    onClose={closeCreditsModal}
                    personName={creditsModalState.personName}
                    filmography={creditsModalState.filmography}
                />
            )}

            <SectionHeader title="Almanac" className="text-center" />

            {foundingDate && daysActive !== null && (
                <div className="text-center mb-6 mt-3 text-slate-400 border-b border-slate-700 pb-3">
                    <div className="text-sm sm:text-base pb-4">
                        Founded on <span className="font-semibold text-slate-300">{foundingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>.
                        <div className="text-xs mt-1">Active <span className="text-slate-200">{daysActive.toLocaleString()}</span> days</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-4">
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

            <ChartContainer className="bg-slate-800 bg-gradient-to-br from-slate-800 to-slate-700/50 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-4">
                <CategorySelector
                    categories={['country', 'language', 'decade']}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleCategorySelected}
                />
                <p className="mb-2 text-center text-xs text-slate-400 mt-3 italic">
                    Click on a category slice, bar, or label to view the corresponding films below.
                </p>
                {donutChartOptions.series && ((donutChartOptions.series[0] as Highcharts.SeriesPieOptions).data?.length || 0) > 0 ? (
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

            <ChartContainer className="bg-slate-800 bg-gradient-to-br from-slate-800 to-slate-700/50 rounded-lg p-3 sm:p-4 md:p-5 shadow-xl border border-slate-600 mb-8 sm:mb-10">
                <p className="mb-2 text-center text-xs text-slate-400 italic">
                    Click on a point to see which film was watched at the end of that interval.
                </p>
                {meetingIntervalChartOptions.series && ((meetingIntervalChartOptions.series[0] as Highcharts.SeriesLineOptions).data?.length || 0) > 0 ? (
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
                                stats={stats}
                                highlights={highlights as any}
                                formatAverage={formatAverage}
                                formatYear={formatYear}
                                getHighlightClass={getHighlightClass as any}
                            />
                        ))}
                    </div>
                ) : (<p className="text-center text-sm text-slate-400 italic py-4">Calculating member stats...</p>)}
            </div>

            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">Frequently Credited Artists</h3>
                {frequentPersons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                        {frequentPersons.map((person) => (
                            <BaseCard key={person.name}>
                                <div className="flex justify-between items-center mb-3 border-b border-slate-600 pb-2">
                                    <h4
                                        className="text-lg font-semibold text-blue-400 hover:text-blue-300 cursor-pointer truncate"
                                        onClick={() => handleFrequentPersonClick(person.name, person.filmography || [])}
                                        title={`View all credits for ${person.name}`}
                                    >
                                        {person.name}
                                    </h4>
                                    <span className="text-sm text-slate-400 flex-shrink-0 ml-2">({person.count} films)</span>
                                </div>
                                <ul className="space-y-2 text-sm">
                                    {(person.filmography || []).slice(0, 5).map(({ film, roles }) => (
                                        <li key={film.imdbID} className="text-slate-300">
                                            <Link to={`/films/${film.imdbID}`} className="hover:text-slate-100 hover:underline">
                                                {film.title} ({film.year})
                                            </Link>
                                            <span className="text-slate-400 text-xs block ml-2">- {roles.join(', ')}</span>
                                        </li>
                                    ))}
                                    {(person.filmography || []).length > 5 && (
                                        <li className="text-center mt-2">
                                            <button
                                                onClick={() => handleFrequentPersonClick(person.name, person.filmography || [])}
                                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                            >
                                                View all {(person.filmography || []).length} credits...
                                            </button>
                                        </li>
                                    )}
                                </ul>
                            </BaseCard>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-slate-400 italic py-4">
                        No persons found appearing in multiple films yet.
                    </p>
                )}
            </div>

            {/* Unanimous Scores Section */}
            <UnanimousScoresCard
                unanimousScores={unanimousScores}
                totalCount={totalUnanimousCount}
            />
        </PageLayout>
    );
};

export default AlmanacPage;