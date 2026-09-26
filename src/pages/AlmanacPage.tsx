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
import SectionHeader from '../components/common/SectionHeader';
import FilmFrameWash from '../components/common/FilmFrameWash';

import { useUnanimousScores } from '../hooks/useUnanimousScores';
import UnanimousScoresCard from '../components/almanac/UnanimousScoresCard';
import FilmConnectionGraph from '../components/almanac/FilmConnectionGraph';

// Helper Functions (can be moved to utils if not already there)
const formatTotalMinutes = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes < 0) {
        return '0 days 00 hrs 00 min';
    }
    const minutesPerDay = 1440;
    const minutesPerHour = 60;
    const days = Math.floor(totalMinutes / minutesPerDay);
    const remainingMinutesAfterDays = totalMinutes % minutesPerDay;
    const hours = Math.floor(remainingMinutesAfterDays / minutesPerHour);
    const minutes = remainingMinutesAfterDays % minutesPerHour;
    const pad = (num: number) => String(num).padStart(2, '0');
    const dayLabel = days === 1 ? 'day' : 'days';
    // Plain words between the figures: StatCard drops them to small caps.
    return `${days} ${dayLabel} ${pad(hours)} hrs ${pad(minutes)} min`;
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
        currentDonutChartData,
        currentDonutChartTitle,
        meetingIntervalData,
    } = useAlmanacCharts(filmData);

    // The figures at the end of each chart's title rule.
    const CATEGORY_PLURALS: Record<ChartCategory, string> = {
        country: 'countries',
        language: 'languages',
        decade: 'decades',
    };
    const donutMeta = currentDonutChartData.length
        ? `${currentDonutChartData.length} ${CATEGORY_PLURALS[selectedCategory]}`
        : null;
    const intervalDays = meetingIntervalData.map((point) => point.y ?? 0);
    const intervalMeta = intervalDays.length
        ? `Avg ${Math.round(intervalDays.reduce((sum, d) => sum + d, 0) / intervalDays.length)} days`
        : null;

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
            {foundingDate && daysActive !== null && (
                // Founding banner, given the profile page's hero treatment: a
                // collage of the club's best-scored films washed behind the date.
                // Set like the profile's title card: a small-caps credit over
                // the date in serif, a short rule, then the tally as an epigraph.
                <HeroBanner films={topRatedFilms} className="mb-4 sm:mb-6">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-blue-300/80">
                        The Almanac · Founded
                    </p>
                    <h1 className="font-serif text-2xl sm:text-3xl leading-snug tracking-tight text-slate-200">
                        {foundingDate.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </h1>
                    <span
                        className="mx-auto mt-4 mb-4 block h-px w-10 bg-slate-500/60"
                        aria-hidden="true"
                    />
                    <p className="font-serif italic text-slate-300">
                        Active for{' '}
                        <span className="not-italic tabular-nums text-slate-100">
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

            <ChartContainer className="mb-4" title={currentDonutChartTitle} meta={donutMeta}>
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

            <ChartContainer
                className="mb-8 sm:mb-10"
                title="Time Between Club Meetings"
                meta={intervalMeta}
            >
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
                <SectionHeader title="Member Stats Breakdown" />
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
                <SectionHeader title="Frequently Credited Artists" />
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
                                <div className="flex justify-between items-baseline mb-3 border-b border-slate-700/60 pb-2">
                                    <h4
                                        className="font-serif text-lg text-slate-100 hover:text-blue-300 transition-colors cursor-pointer truncate"
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
                                    <span className="ml-2 flex-shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                        <span className="mr-1 font-serif text-sm normal-case tracking-normal tabular-nums text-slate-300">
                                            {person.count}
                                        </span>
                                        films
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
                                                    {film.title}
                                                </Link>
                                                <span className="ml-1.5 font-serif text-xs tabular-nums text-slate-500">
                                                    {film.year}
                                                </span>
                                                <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                                                    {roles.join(' · ')}
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

            <FilmConnectionGraph films={filmData} />

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
