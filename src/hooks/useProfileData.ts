import { useState, useEffect, useMemo, useCallback } from 'react';
import { Film, filmData as allFilmsData, getClubRating } from '../types/film';
import { teamMembers as allTeamMembersData, TeamMember } from '../types/team';
import {
    calculateMemberStats,
    getRankString,
    UserProfileStats,
    UserRankings,
    ControversialFilm,
    MemberStatsCalculationData
} from '../utils/statUtils';
import { ProfileReviewBlurb } from '../components/profile/ProfileBlurbItem'; // Assuming this type is defined correctly

export interface UseProfileDataReturn {
    member: TeamMember | null;
    selectedFilms: Film[];
    topRatedFilms: Film[];
    mostControversialFilms: ControversialFilm[];
    currentUserStats: UserProfileStats | null;
    rankings: UserRankings | null;
    reviewBlurbs: ProfileReviewBlurb[];
    loading: boolean;
    error: string | null;
    isInterviewExpanded: boolean;
    toggleInterviewExpanded: () => void;
    isBlurbsSectionExpanded: boolean;
    toggleBlurbsSectionExpanded: () => void;
}

export const useProfileData = (memberNameParam?: string): UseProfileDataReturn => {
    const [member, setMember] = useState<TeamMember | null>(null);
    const [selectedFilms, setSelectedFilms] = useState<Film[]>([]);
    const [topRatedFilms, setTopRatedFilms] = useState<Film[]>([]);
    const [mostControversialFilms, setMostControversialFilms] = useState<ControversialFilm[]>([]);
    const [currentUserStats, setCurrentUserStats] = useState<UserProfileStats | null>(null);
    const [rankings, setRankings] = useState<UserRankings | null>(null);
    const [reviewBlurbs, setReviewBlurbs] = useState<ProfileReviewBlurb[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isInterviewExpanded, setIsInterviewExpanded] = useState(false);
    const [isBlurbsSectionExpanded, setIsBlurbsSectionExpanded] = useState(false);

    // Memoized calculation for all member stats (used for ranking)
    const allMemberStatsData = useMemo(() => {
        const activeMembers = allTeamMembersData.filter(m => typeof m.queue === 'number' && m.queue > 0);
        if (!activeMembers.length) return [];

        return activeMembers.map(m => {
            const memberName = m.name;
            const comprehensiveStats = calculateMemberStats(memberName, allFilmsData);

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
                countryDiversityPercentage: comprehensiveStats.countryDiversityPercentage, // ADD THIS
            };

            const rankValues: MemberStatsCalculationData['rankValues'] = {
                totalRuntime: profileStats.totalRuntime,
                avgRuntime: profileStats.avgRuntime,
                avgSelectedScore: profileStats.avgSelectedScore,
                avgGivenScore: profileStats.avgGivenScore,
                avgDivergence: profileStats.avgDivergence,
                avgAbsoluteDivergence: profileStats.avgAbsoluteDivergence,
                countryDiversityPercentage: profileStats.countryDiversityPercentage, // ADD THIS
            };

            return { memberName, stats: profileStats, rankValues };
        });
    }, [allFilmsData, allTeamMembersData]);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        setError(null);
        // Reset all states
        setMember(null);
        setSelectedFilms([]);
        setTopRatedFilms([]);
        setMostControversialFilms([]);
        setCurrentUserStats(null);
        setRankings(null);
        setReviewBlurbs([]);
        setIsInterviewExpanded(false);
        setIsBlurbsSectionExpanded(false);


        if (!memberNameParam) {
            setError("Member name is missing.");
            setLoading(false);
            return;
        }

        const decodedMemberName = decodeURIComponent(memberNameParam);
        const foundMember = allTeamMembersData.find(m => m.name === decodedMemberName);

        if (!foundMember) {
            setError(`Member "${decodedMemberName}" not found.`);
            setLoading(false);
            return;
        }
        setMember(foundMember);
        const normalizedUserName = decodedMemberName.toLowerCase();

        // Films Selected by Member
        const filmsSelected = allFilmsData
            .filter(film => film.movieClubInfo?.selector === foundMember.name)
            .sort((a, b) => (new Date(b.movieClubInfo?.watchDate || 0).getTime() - new Date(a.movieClubInfo?.watchDate || 0).getTime()) || a.title.localeCompare(b.title));
        setSelectedFilms(filmsSelected);

        // Top Rated Films by Member
        const filmsRated = allFilmsData
            .filter(film => film.movieClubInfo?.clubRatings.some(r => r.user.toLowerCase() === normalizedUserName && typeof r.score === 'number'))
            .sort((a, b) => (getClubRating(b, normalizedUserName)?.score ?? -Infinity) - (getClubRating(a, normalizedUserName)?.score ?? -Infinity) || (new Date(b.movieClubInfo?.watchDate || 0).getTime() - new Date(a.movieClubInfo?.watchDate || 0).getTime()) || a.title.localeCompare(b.title))
            .slice(0, 6);
        setTopRatedFilms(filmsRated);

        // Review Blurbs
        const blurbs: ProfileReviewBlurb[] = allFilmsData
            .map(film => {
                const userRating = film.movieClubInfo?.clubRatings.find(r => r.user.toLowerCase() === normalizedUserName && r.blurb && typeof r.score === 'number');
                if (userRating) {
                    return {
                        filmId: film.imdbID,
                        filmTitle: film.title,
                        filmPoster: film.poster,
                        blurb: userRating.blurb!,
                        score: userRating.score!,
                        watchDate: film.movieClubInfo?.watchDate || undefined
                    };
                }
                return null;
            })
            .filter(b => b !== null)
            .sort((a, b) => (new Date(b!.watchDate || 0).getTime() - new Date(a!.watchDate || 0).getTime()) || a!.filmTitle.localeCompare(b!.filmTitle)) as ProfileReviewBlurb[];
        setReviewBlurbs(blurbs);


        // Most Controversial Films for this member
        const controversial: ControversialFilm[] = [];
        allFilmsData.forEach(film => {
            const validRatings = film.movieClubInfo?.clubRatings?.filter(r => r.score !== null && typeof r.score === 'number');
            if (!validRatings || validRatings.length < 2) return;

            const userSpecificRating = validRatings.find(r => r.user.toLowerCase() === normalizedUserName);
            if (!userSpecificRating || userSpecificRating.score === null) return;

            const currentUserScore = Number(userSpecificRating.score);
            const otherRatings = validRatings.filter(r => r.user.toLowerCase() !== normalizedUserName);

            if (otherRatings.length > 0) {
                const othersAvg = otherRatings.reduce((sum, r) => sum + Number(r.score), 0) / otherRatings.length;
                const signedDivergence = currentUserScore - othersAvg;
                // Only add if this user's score is part of the divergence calculation.
                // We are interested in how this specific user diverges.
                controversial.push({
                    filmId: film.imdbID,
                    title: film.title,
                    userScore: currentUserScore,
                    othersAvgScore: othersAvg,
                    divergence: signedDivergence, // Keep it signed
                    posterUrl: film.poster,
                    watchDate: film.movieClubInfo?.watchDate || undefined,
                    memberName: decodedMemberName
                });
            }
        });
        mostControversialFilms.sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence) || (new Date(b.watchDate || 0).getTime() - new Date(a.watchDate || 0).getTime()));
        setMostControversialFilms(controversial.sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence)).slice(0, 4))


        // Stats and Rankings
        const currentUserData = allMemberStatsData.find(data => data.memberName === decodedMemberName);
        if (currentUserData) {
            setCurrentUserStats(currentUserData.stats);
            const { rankValues } = currentUserData;
            setRankings({
                totalRuntimeRank: getRankString(rankValues.totalRuntime, allMemberStatsData.map(d => d.rankValues.totalRuntime), true),
                // IMPORTANT: higher often better for avg runtime
                avgRuntimeRank: getRankString(rankValues.avgRuntime, allMemberStatsData.map(d => d.rankValues.avgRuntime), true),
                avgSelectedScoreRank: getRankString(rankValues.avgSelectedScore, allMemberStatsData.map(d => d.rankValues.avgSelectedScore), true),
                avgGivenScoreRank: getRankString(rankValues.avgGivenScore, allMemberStatsData.map(d => d.rankValues.avgGivenScore), true),
                // VERY IMPORTANT: the top rank (1st) should be the MOST divergent. More divergent is BETTER here
                avgDivergenceRank: getRankString(rankValues.avgAbsoluteDivergence, allMemberStatsData.map(d => d.rankValues.avgAbsoluteDivergence), true),
                countryDiversityRank: getRankString(
                    rankValues.countryDiversityPercentage,
                    allMemberStatsData.map(d => d.rankValues.countryDiversityPercentage),
                    true
                )
            });
        } else { // Handle inactive members or members not in the "active" cycle for ranking
            const comprehensiveStats = calculateMemberStats(decodedMemberName, allFilmsData);
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
                countryDiversityPercentage: comprehensiveStats.countryDiversityPercentage, 
            };
            setCurrentUserStats(profileStats);
            setRankings({ totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null, countryDiversityRank: null });
        }

        setLoading(false);
    }, [memberNameParam, allMemberStatsData]); // Rerun when memberNameParam or the memoized allMemberStatsData changes

    const toggleInterviewExpanded = useCallback(() => setIsInterviewExpanded(prev => !prev), []);
    const toggleBlurbsSectionExpanded = useCallback(() => setIsBlurbsSectionExpanded(prev => !prev), []);

    return {
        member,
        selectedFilms,
        topRatedFilms,
        mostControversialFilms,
        currentUserStats,
        rankings,
        reviewBlurbs,
        loading,
        error,
        isInterviewExpanded,
        toggleInterviewExpanded,
        isBlurbsSectionExpanded,
        toggleBlurbsSectionExpanded,
    };
};