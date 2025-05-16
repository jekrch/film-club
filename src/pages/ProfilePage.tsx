import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ChevronLeftIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// Common Components
import CircularImage from '../components/common/CircularImage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorDisplay from '../components/common/ErrorDisplay';
// Film Components
import FilmList from '../components/films/FilmList';
// Profile Specific Components
import InterviewItem from '../components/profile/InterviewItem';
import ProfileStatsSection from '../components/profile/ProfileStatsSection';
import ControversialFilmItem from '../components/profile/ControversialFilmItem';
// Data and Types
import { teamMembers as allTeamMembers, TeamMember } from '../types/team';
import { Film, getClubRating, filmData } from '../types/film';
import PageLayout from '../components/layout/PageLayout';
import { ProfileReviewBlurb } from '../components/profile/ProfileBlurbItem';
import ProfileBlurbItem from '../components/profile/ProfileBlurbItem';
import BaseCard from '../components/common/BaseCard';
// Utility Functions and Types
import {
    calculateMemberStats,
    getRankString,
    UserProfileStats,
    UserRankings,
    MemberStatsCalculationData,
    ControversialFilm
} from '../utils/statUtils';

// --- Main Profile Page Component ---
const ProfilePage: React.FC = () => {
    const { memberName } = useParams<{ memberName: string }>();
    const navigate = useNavigate();
    const [member, setMember] = useState<TeamMember | null>(null);
    const [selectedFilms, setSelectedFilms] = useState<Film[]>([]);
    const [topRatedFilms, setTopRatedFilms] = useState<Film[]>([]);
    const [mostControversialFilms, setMostControversialFilms] = useState<ControversialFilm[]>([]);
    const [currentUserStats, setCurrentUserStats] = useState<UserProfileStats | null>(null);
    const [rankings, setRankings] = useState<UserRankings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isInterviewExpanded, setIsInterviewExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [reviewBlurbs, setReviewBlurbs] = useState<ProfileReviewBlurb[]>([]);
    const [isBlurbsSectionExpanded, setIsBlurbsSectionExpanded] = useState(false);

    const calculateAllMemberStats = useMemo(() => {
        return (films: Film[], activeMembers: TeamMember[]): { memberName: string, stats: UserProfileStats, rankValues: MemberStatsCalculationData['rankValues'] }[] => {
            return activeMembers.map(m => {
                const memberName = m.name;
                const comprehensiveStats = calculateMemberStats(memberName, films);
                const profileStats: UserProfileStats = {
                    totalSelections: comprehensiveStats.totalSelections,
                    totalRuntime: comprehensiveStats.totalRuntime,
                    avgRuntime: comprehensiveStats.avgRuntime,
                    topGenres: comprehensiveStats.topGenres,
                    avgSelectedScore: comprehensiveStats.avgSelectedScore,
                    avgGivenScore: comprehensiveStats.avgGivenScore,
                    avgDivergence: comprehensiveStats.avgDivergence,
                    avgAbsoluteDivergence: comprehensiveStats.avgAbsoluteDivergence,
                    languageCount: comprehensiveStats.languageCount,
                    countryCount: comprehensiveStats.countryCount,
                };
                const rankValues = {
                    totalRuntime: profileStats.totalRuntime,
                    avgRuntime: profileStats.avgRuntime,
                    avgSelectedScore: profileStats.avgSelectedScore,
                    avgGivenScore: profileStats.avgGivenScore,
                    avgAbsoluteDivergence: profileStats.avgAbsoluteDivergence
                };
                return { memberName, stats: profileStats, rankValues } as any;
            });
        };
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        setError(null);
        setMember(null);
        setSelectedFilms([]);
        setTopRatedFilms([]);
        setMostControversialFilms([]);
        setCurrentUserStats(null);
        setRankings(null);
        setIsInterviewExpanded(false);
        setReviewBlurbs([]);
        setIsBlurbsSectionExpanded(false);

        if (!memberName) {
            setError("Member name is missing in the URL.");
            setLoading(false);
            return;
        }

        const decodedMemberName = decodeURIComponent(memberName);
        const normalizedUserName = decodedMemberName.toLowerCase();
        const foundMember = allTeamMembers.find(m => m.name === decodedMemberName);

        if (!foundMember) {
            setError(`Member "${decodedMemberName}" not found.`);
            setLoading(false);
            return;
        }
        setMember(foundMember);

        const filmsSelectedByMember = filmData
            .filter(film => film.movieClubInfo?.selector === foundMember.name)
            .sort((a, b) => {
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA;
                return a.title.localeCompare(b.title);
            });
        setSelectedFilms(filmsSelectedByMember);

        const filmsRatedByMember = filmData
            .filter(film => {
                const memberRating = film.movieClubInfo?.clubRatings.find(
                    rating => rating.user.toLowerCase() === normalizedUserName
                );
                return memberRating && typeof memberRating.score === 'number' && !isNaN(memberRating.score);
            })
            .sort((a, b) => {
                const ratingA = getClubRating(a, normalizedUserName)?.score ?? -Infinity;
                const ratingB = getClubRating(b, normalizedUserName)?.score ?? -Infinity;
                if (ratingB !== ratingA) return ratingB - ratingA;
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA;
                return a.title.localeCompare(b.title);
            })
            .slice(0, 6);
        setTopRatedFilms(filmsRatedByMember);

        const collectedBlurbs: ProfileReviewBlurb[] = [];
        filmData.forEach(film => {
            const userRating = film.movieClubInfo?.clubRatings.find(
                rating => rating.user.toLowerCase() === normalizedUserName && rating.blurb && typeof rating.score === 'number' && !isNaN(rating.score)
            );
            if (userRating && userRating.blurb) {
                collectedBlurbs.push({
                    filmId: film.imdbID,
                    filmTitle: film.title,
                    filmPoster: film.poster,
                    blurb: userRating.blurb,
                    score: userRating.score as number,
                    watchDate: film.movieClubInfo?.watchDate!
                });
            }
        });
        collectedBlurbs.sort((a, b) => {
            const dateAValue = a.watchDate ? new Date(a.watchDate).getTime() : 0;
            const dateBValue = b.watchDate ? new Date(b.watchDate).getTime() : 0;
            if (dateAValue === 0 && dateBValue !== 0) return 1;
            if (dateBValue === 0 && dateAValue !== 0) return -1;
            if (dateBValue !== dateAValue) return dateBValue - dateAValue;
            return a.filmTitle.localeCompare(b.filmTitle);
        });
        setReviewBlurbs(collectedBlurbs);

        const controversialFilmsData: ControversialFilm[] = [];
        filmData.forEach(film => {
            const validRatings = film.movieClubInfo?.clubRatings?.filter(r => r.score !== null && typeof r.score === 'number' && !isNaN(r.score));
            if (!validRatings || validRatings.length < 2) return;
            let maxAbsoluteDivergenceForFilm = -1;
            let mostDivergentUserForFilmLower = '';
            let filmControversyDetails: { [userNameLower: string]: { userScore: number; othersAvg: number | null; signedDivergence: number; absoluteDivergence: number } } = {};
            validRatings.forEach(rating => {
                const currentUserScore = Number(rating.score);
                const currentUserNameLower = rating.user.toLowerCase();
                const otherRatingsForThisUser = validRatings.filter(r => r.user.toLowerCase() !== currentUserNameLower);
                if (otherRatingsForThisUser.length > 0) {
                    let othersTotal = 0;
                    otherRatingsForThisUser.forEach(r => othersTotal += Number(r.score));
                    const othersAvg = othersTotal / otherRatingsForThisUser.length;
                    const signedDivergence = currentUserScore - othersAvg;
                    const absoluteDivergence = Math.abs(signedDivergence);
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: othersAvg, signedDivergence: signedDivergence, absoluteDivergence: absoluteDivergence };
                    if (absoluteDivergence > maxAbsoluteDivergenceForFilm) {
                        maxAbsoluteDivergenceForFilm = absoluteDivergence;
                        mostDivergentUserForFilmLower = currentUserNameLower;
                    }
                } else {
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: null, signedDivergence: 0, absoluteDivergence: 0 };
                }
            });
            if (mostDivergentUserForFilmLower === normalizedUserName && maxAbsoluteDivergenceForFilm > 1e-9) {
                const details = filmControversyDetails[normalizedUserName];
                if (details) {
                    controversialFilmsData.push({
                        filmId: film.imdbID,
                        title: film.title,
                        userScore: details.userScore,
                        othersAvgScore: details.othersAvg,
                        divergence: details.signedDivergence,
                        posterUrl: film.poster,
                        watchDate: film.movieClubInfo?.watchDate as any,
                        memberName: decodedMemberName
                    });
                }
            }
        });
        controversialFilmsData.sort((a, b) => {
            const divergenceDiff = Math.abs(b.divergence) - Math.abs(a.divergence);
            if (divergenceDiff !== 0) return divergenceDiff;
            const dateA = a.watchDate ? new Date(a.watchDate).getTime() : 0;
            const dateB = b.watchDate ? new Date(b.watchDate).getTime() : 0;
            return dateB - dateA;
        });
        setMostControversialFilms(controversialFilmsData.slice(0, 4));

        const activeMembers = allTeamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        const nullRankings: UserRankings = { totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null };

        if (activeMembers.length > 0) {
            const allStatsData = calculateAllMemberStats(filmData, activeMembers);
            const currentUserData = allStatsData.find(data => data.memberName === decodedMemberName);
            if (currentUserData) {
                setCurrentUserStats(currentUserData.stats);
                const allTotals = allStatsData.map(d => d.rankValues.totalRuntime);
                const allAvgs = allStatsData.map(d => d.rankValues.avgRuntime);
                const allSelScores = allStatsData.map(d => d.rankValues.avgSelectedScore);
                const allGivenScores = allStatsData.map(d => d.rankValues.avgGivenScore);
                const allAbsDivs = allStatsData.map(d => d.rankValues.avgAbsoluteDivergence);
                setRankings({
                    totalRuntimeRank: getRankString(currentUserData.rankValues.totalRuntime, allTotals, true),
                    avgRuntimeRank: getRankString(currentUserData.rankValues.avgRuntime, allAvgs, true),
                    avgSelectedScoreRank: getRankString(currentUserData.rankValues.avgSelectedScore, allSelScores, true),
                    avgGivenScoreRank: getRankString(currentUserData.rankValues.avgGivenScore, allGivenScores, true),
                    avgDivergenceRank: getRankString(currentUserData.rankValues.avgAbsoluteDivergence, allAbsDivs, true),
                });
            } else {
                const inactiveMemberFullStats = calculateMemberStats(foundMember.name, filmData);
                const inactiveMemberStats: UserProfileStats = { /* ... copy from previous ... */
                    totalSelections: inactiveMemberFullStats.totalSelections, totalRuntime: inactiveMemberFullStats.totalRuntime, avgRuntime: inactiveMemberFullStats.avgRuntime, topGenres: inactiveMemberFullStats.topGenres, avgSelectedScore: inactiveMemberFullStats.avgSelectedScore, avgGivenScore: inactiveMemberFullStats.avgGivenScore, avgDivergence: inactiveMemberFullStats.avgDivergence, avgAbsoluteDivergence: inactiveMemberFullStats.avgAbsoluteDivergence, languageCount: inactiveMemberFullStats.languageCount, countryCount: inactiveMemberFullStats.countryCount,
                };
                setCurrentUserStats(inactiveMemberStats);
                setRankings(nullRankings);
            }
        } else {
            const singleMemberFullStats = calculateMemberStats(foundMember.name, filmData);
            const singleMemberStats: UserProfileStats = { /* ... copy from previous ... */
                totalSelections: singleMemberFullStats.totalSelections, totalRuntime: singleMemberFullStats.totalRuntime, avgRuntime: singleMemberFullStats.avgRuntime, topGenres: singleMemberFullStats.topGenres, avgSelectedScore: singleMemberFullStats.avgSelectedScore, avgGivenScore: singleMemberFullStats.avgGivenScore, avgDivergence: singleMemberFullStats.avgDivergence, avgAbsoluteDivergence: singleMemberFullStats.avgAbsoluteDivergence, languageCount: singleMemberFullStats.languageCount, countryCount: singleMemberFullStats.countryCount,
            };
            setCurrentUserStats(singleMemberStats);
            setRankings(nullRankings);
        }
        setLoading(false);
    }, [memberName, calculateAllMemberStats]);


    if (loading) return <LoadingSpinner />;
    if (error || !member) {
        const errorMessage = error || "Could not load profile details.";
        return <ErrorDisplay message={errorMessage} backPath="/about" backButtonLabel="Back to About Page" />;
    }

    const MAX_INTERVIEW_ITEMS_BEFORE_SCROLL = 2;
    const needsInterviewExpansion = member.interview && member.interview.length > MAX_INTERVIEW_ITEMS_BEFORE_SCROLL;
    const collapsedInterviewMaxHeight = 'max-h-80';
    const hasEnoughControversialFilms = mostControversialFilms.length >= 1;
    const hasStats = currentUserStats && Object.entries(currentUserStats).some(([key, val]) =>
        (val !== null && val !== 0 && (!Array.isArray(val) || val.length > 0))
        || (key === 'totalSelections' && val === 0)
    );

    const MAX_BLURBS_COLLAPSED = 3;
    const needsBlurbsSectionExpansion = reviewBlurbs.length > MAX_BLURBS_COLLAPSED;
    const displayedBlurbs = isBlurbsSectionExpanded ? reviewBlurbs : reviewBlurbs.slice(0, MAX_BLURBS_COLLAPSED);
    const MAX_RATING_DISPLAY = 9;

    return (
        <PageLayout>

            <button
                onClick={() => navigate(-1)}
                className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            >
                <ChevronLeftIcon className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                Back
            </button>

            <BaseCard className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden mb-8 border">
                <div className="py-12 sm:p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-10 md:space-x-16">
                    <CircularImage
                        src={member.image}
                        alt={member.name}
                        size="w-36 h-36 sm:w-40 sm:h-40 md:w-48 md:h-48"
                        className="flex-shrink-0 border-2 border-slate-600 mb-4 !sm:mb-6 sm:mb-0 shadow-lg"
                    />
                    <div className="text-center sm:text-left flex-grow min-w-0 sm:ml-8 mt-3 sm:mt-2">
                        <h1 className="text-3xl sm:text-4xl text-slate-100 mb-2 break-words font-thin">{member.name}</h1>
                        <p className="text-lg text-blue-400/90 mb-1">{member.title}</p>
                        <div className="text-slate-300 leading-relaxed mx-auto sm:mx-0 prose prose-sm prose-invert max-w-none">
                            <ReactMarkdown>{member.bio}</ReactMarkdown>
                        </div>
                    </div>
                </div>
            </BaseCard>

            {member.interview && member.interview.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3"> Interview </h3>
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isInterviewExpanded && needsInterviewExpansion ? collapsedInterviewMaxHeight : 'max-h-[1500px]'}`}>
                        <div className={`pr-2 -mr-2 ${!isInterviewExpanded && needsInterviewExpansion ? 'overflow-y-auto ' + collapsedInterviewMaxHeight : ''}`}>
                            <div className="divide-y divide-slate-700 -mt-4">
                                {member.interview.map((item, index) => <InterviewItem key={index} question={item.question} answer={item.answer} />)}
                            </div>
                        </div>
                    </div>
                    {needsInterviewExpansion && (
                        <div className="mt-4 text-center border-t border-slate-700 pt-4">
                            <button
                                onClick={() => setIsInterviewExpanded(!isInterviewExpanded)}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded"
                                aria-expanded={isInterviewExpanded}
                            >
                                {isInterviewExpanded ? (<> Show Less <ChevronUpIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>) : (<> Show Full Interview <ChevronDownIcon className="h-4 w-4 ml-1" aria-hidden="true" /> </>)}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {(hasStats || hasEnoughControversialFilms) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className={`lg:col-span-2 ${!hasStats ? 'hidden lg:block' : ''}`}>
                        {hasStats ? (
                            <ProfileStatsSection stats={currentUserStats} rankings={rankings} />
                        ) : (
                            <div className="hidden lg:block lg:col-span-2"></div>
                        )}
                    </div>
                    {hasEnoughControversialFilms && (
                        <div className="lg:col-span-1">
                            <BaseCard className="p-6 bg-slate-700/50! h-full">
                                <h4 className="text-lg font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-600/50">
                                    Most Divergent Scores
                                </h4>
                                <div className="space-y-3">
                                    {mostControversialFilms.map((film) => (
                                        <ControversialFilmItem key={film.filmId} film={film} />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 mt-4 text-center italic">
                                    Films where {member.name} had the largest score difference (magnitude) from the club average.
                                </p>
                            </BaseCard>
                        </div>
                    )}
                    {!hasEnoughControversialFilms && hasStats && (
                        <div className="lg:col-span-1 hidden lg:block"></div>
                    )}
                </div>
            )}

            {reviewBlurbs.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <h4 className="text-2xl font-bold text-slate-100 mb-6 border-b border-slate-700 pb-3">In Their Own Words</h4>
                    <div className="space-y-5">
                        {displayedBlurbs.map((blurbItem) => (
                            <div key={blurbItem.filmId} className="pt-5 border-t border-slate-700/50 first:pt-0 first:border-t-0">
                                <ProfileBlurbItem blurbItem={blurbItem} maxRating={MAX_RATING_DISPLAY} />
                            </div>
                        ))}
                    </div>
                    {needsBlurbsSectionExpansion && (
                        <div className="mt-6 text-center border-t border-slate-700 pt-4">
                            <button
                                onClick={() => setIsBlurbsSectionExpanded(!isBlurbsSectionExpanded)}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded"
                                aria-expanded={isBlurbsSectionExpanded}
                            >
                                {isBlurbsSectionExpanded ? (<> Show Fewer Reviews <ChevronUpIcon className="h-4 w-4 ml-1" /> </>) : (<> Show More Reviews <ChevronDownIcon className="h-4 w-4 ml-1" /> </>)}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {topRatedFilms.length > 0 && (
                <div className="mb-12 mt-8">
                    <FilmList
                        films={topRatedFilms}
                        title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                    />
                </div>
            )}

            {selectedFilms.length > 0 ? (
                <div className="mb-12 mt-8">
                    <FilmList
                        films={selectedFilms}
                        title={`Films Selected by ${member.name}`}
                    />
                </div>
            ) : (
                (!currentUserStats || currentUserStats.totalSelections === null || currentUserStats.totalSelections < 0) && (
                    <div className="text-center py-8 text-slate-400 italic mt-8">
                        {member.name} hasn't selected any films yet.
                    </div>
                )
            )}

        </PageLayout>
    );
};

export default ProfilePage;