import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import { Film, filmData } from '../types/film';
import { TeamMember, teamMembers as teamMembersData } from '../types/team';
import { parseWatchDate as parseWatchDateUtil, countValidRatings } from '../utils/filmUtils'; // Renamed to avoid conflict
import { calculateClubAverage } from '../utils/ratingUtils';

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
import AccentCard from '../components/common/AccentCard';
import Button from '../components/common/Button';
import HeroBanner from '../components/common/HeroBanner';
import FilmFrameWash from '../components/common/FilmFrameWash';

import { useUnanimousScores } from '../hooks/useUnanimousScores';
import UnanimousScoresCard from '../components/almanac/UnanimousScoresCard';
import FilmConnectionGraph from '../components/almanac/FilmConnectionGraph';

// Helper Functions (can be moved to utils if not already there)
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return '0 days : 00 hrs : 00 m';
    }
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

    const { allMemberStats, getHighlightClass, formatAverage, formatYear } = useMemberStatistics(
        filmData,
        teamMembersData as TeamMember[]
    );

    const { frequentPersons, creditsModalState, handleFrequentPersonClick, closeCreditsModal } =
        useFrequentPersons(filmData);

    // General stats, derived during render rather than in an effect.
    //
    // `filmData` is a static import, so there is nothing here to wait for — and
    // computing it in a passive effect cost the page its first frame: the
    // founding banner is gated on `foundingDate`, so the initial paint had no
    // banner at all and the stat cards sat where it belongs. A frame later the
    // state landed, the banner mounted, and everything below it dropped by the
    // banner's full height. Deriving it during render means the first painted
    // frame is already the finished page, at its final height.
    const { totalRuntimeString, totalFilmsCount, watchedFilmsCount, foundingDate, daysActive } =
        useMemo(() => {
            const watchedWithDates = filmData
                .map((f) => ({ ...f, pDate: parseWatchDateUtil(f.movieClubInfo?.watchDate) }))
                .filter((f) => f.pDate) as (Film & { pDate: Date })[];
            // Sort ascending by date to find the first (founding) date
            const sortedWatchedForFounding = [...watchedWithDates].sort(
                (a, b) => a.pDate.getTime() - b.pDate.getTime()
            );
            const firstDate = sortedWatchedForFounding[0]?.pDate ?? null;

            const totalMinutes = watchedWithDates.reduce((sum, film) => {
                const runtimeStr = film.runtime;
                if (runtimeStr && typeof runtimeStr === 'string') {
                    const rt = parseInt(runtimeStr.replace(/\D/g, ''), 10);
                    if (!isNaN(rt)) return sum + rt;
                }
                return sum;
            }, 0);

            return {
                totalRuntimeString: formatTotalMinutes(totalMinutes),
                totalFilmsCount: filmData.length,
                watchedFilmsCount: watchedWithDates.length,
                foundingDate: firstDate,
                daysActive: firstDate ? daysBetween(firstDate, new Date()) : null,
            };
        }, []); // filmData is static; the only live input is today's date

    // The club's highest-scoring films, used as the collage behind the founding
    // banner. Requires 2+ scores so a single outlier rating can't top the list.
    const topRatedFilms = useMemo(
        () =>
            filmData
                .map((film) => ({
                    film,
                    avg: calculateClubAverage(film.movieClubInfo?.clubRatings),
                }))
                .filter(
                    (entry): entry is { film: Film; avg: number } =>
                        entry.avg !== null &&
                        countValidRatings(entry.film.movieClubInfo?.clubRatings) >= 2
                )
                .sort((a, b) => b.avg - a.avg)
                .slice(0, 12)
                .map(({ film }) => film),
        []
    );

    const handleCategorySelected = useCallback(
        (category: ChartCategory) => {
            setSelectedCategory(category);
        },
        [setSelectedCategory]
    );

    const { unanimousScores, totalUnanimousCount } = useUnanimousScores(
        filmData,
        teamMembersData as TeamMember[]
    );

    return (
        <PageLayout>
            {/* Always mounted so the modal can run its own close animation. */}
            <CreditsModal
                isOpen={creditsModalState.isOpen}
                onClose={closeCreditsModal}
                personName={creditsModalState.personName}
                filmography={creditsModalState.filmography}
            />
            {/*
            <SectionHeader title="Almanac" className="text-center" />
            */}
            {foundingDate && daysActive !== null && (
                // Founding banner, given the profile page's hero treatment: a
                // collage of the club's best-scored films washed behind the date.
                <HeroBanner films={topRatedFilms} className="mb-4 sm:mb-6">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-blue-300/70 font-semibold mb-4">
                        Founded
                    </p>
                    <p className="text-xl sm:text-2xl font-light text-slate-100">
                        {foundingDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </p>
                    <p className="mt-3 text-sm text-slate-400">
                        Active{' '}
                        <span className="font-mono text-slate-200">
                            {daysActive.toLocaleString()}
                        </span>{' '}
                        days
                    </p>
                </HeroBanner>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-4">
                <StatCard
                    label="Total Watch Time"
                    value={totalRuntimeString}
                    description={`Across ${watchedFilmsCount} watched films.`}
                />
                <StatCard
                    label="Total Films Logged"
                    value={totalFilmsCount}
                    description="Watched & upcoming."
                />
            </div>

            <ChartContainer className="mb-4">
                <CategorySelector
                    categories={['country', 'language', 'decade']}
                    selectedCategory={selectedCategory}
                    onSelectCategory={handleCategorySelected}
                />
                <p className="mb-2 text-center text-xs text-slate-400 mt-3 italic">
                    Click on a category slice, bar, or label to view the corresponding films below.
                </p>
                {donutChartOptions.series &&
                ((donutChartOptions.series[0] as Highcharts.SeriesPieOptions).data?.length || 0) >
                    0 ? (
                    <HighchartsReact highcharts={Highcharts} options={donutChartOptions} />
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">Loading chart...</div>
                )}
            </ChartContainer>

            {selectedPieSliceName && (
                <FilteredFilmListSection
                    listRef={filmListRef as any}
                    title={filteredListTitle}
                    films={filteredFilmsForPieSlice}
                    onClose={closeFilteredList}
                    layoutMode="horizontal"
                    hideSizeButtons={true}
                />
            )}

            <ChartContainer className="mb-8 sm:mb-10">
                <p className="mb-2 text-center text-xs text-slate-400 italic">
                    Click on a point to see which film was watched at the end of that interval.
                </p>
                {meetingIntervalChartOptions.series &&
                ((meetingIntervalChartOptions.series[0] as Highcharts.SeriesLineOptions).data
                    ?.length || 0) > 0 ? (
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={meetingIntervalChartOptions}
                    />
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        Loading intervals...
                    </div>
                )}
                {selectedIntervalDetail && (
                    <IntervalDetailDisplay
                        detail={selectedIntervalDetail}
                        onClose={closeIntervalDetail}
                    />
                )}
            </ChartContainer>

            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">
                    Member Stats Breakdown
                </h3>
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
                ) : (
                    <p className="text-center text-sm text-slate-400 italic py-4">
                        Calculating member stats...
                    </p>
                )}
            </div>

            <div className="mb-8 sm:mb-10">
                <h3 className="text-xl sm:text-2xl font-semibold text-center mb-6 text-slate-100">
                    Frequently Credited Artists
                </h3>
                {frequentPersons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6">
                        {frequentPersons.map((person) => (
                            // No rail: one card per artist, repeating in a grid.
                            // The wash is drawn from the artist's own films.
                            <AccentCard
                                key={person.name}
                                rail={false}
                                className="p-4"
                                decoration={
                                    <FilmFrameWash
                                        films={(person.filmography || []).map(
                                            (credit) => credit.film
                                        )}
                                    />
                                }
                            >
                                <div className="flex justify-between items-center mb-3 border-b border-slate-700/60 pb-2">
                                    <h4
                                        className="text-lg font-semibold text-blue-400 hover:text-blue-300 cursor-pointer truncate"
                                        onClick={() =>
                                            handleFrequentPersonClick(
                                                person.name,
                                                person.filmography || []
                                            )
                                        }
                                        title={`View all credits for ${person.name}`}
                                    >
                                        {person.name}
                                    </h4>
                                    <span className="text-sm text-slate-400 flex-shrink-0 ml-2">
                                        ({person.count} films)
                                    </span>
                                </div>
                                <ul className="space-y-2 text-sm">
                                    {(person.filmography || [])
                                        .slice(0, 5)
                                        .map(({ film, roles }) => (
                                            <li key={film.imdbID} className="text-slate-300">
                                                <Link
                                                    to={`/films/${film.imdbID}`}
                                                    className="hover:text-slate-100 hover:underline"
                                                >
                                                    {film.title} ({film.year})
                                                </Link>
                                                <span className="text-slate-400 text-xs block ml-2">
                                                    - {roles.join(', ')}
                                                </span>
                                            </li>
                                        ))}
                                    {(person.filmography || []).length > 5 && (
                                        <li className="text-center mt-2">
                                            <Button
                                                onClick={() =>
                                                    handleFrequentPersonClick(
                                                        person.name,
                                                        person.filmography || []
                                                    )
                                                }
                                                variant="link"
                                                size="xs"
                                            >
                                                View all {(person.filmography || []).length}{' '}
                                                credits...
                                            </Button>
                                        </li>
                                    )}
                                </ul>
                            </AccentCard>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-slate-400 italic py-4">
                        No persons found appearing in multiple films yet.
                    </p>
                )}
            </div>

            <FilmConnectionGraph
                films={filmData}
                className="backdrop-grayscale-50 backdrop-opacity-50"
            />

            <div className="h-8" />
            {/* Unanimous Scores Section */}
            <UnanimousScoresCard
                unanimousScores={unanimousScores}
                totalCount={totalUnanimousCount}
            />
        </PageLayout>
    );
};

export default AlmanacPage;
