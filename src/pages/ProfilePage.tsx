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
import { teamMembers as allTeamMembers } from '../types/team'; 
import { Film, getClubRating, filmData } from '../types/film'; 
// Utility Functions and Types
import {
    calculateMemberStats,
    getRankString,
    UserProfileStats,
    UserRankings,
    MemberStatsCalculationData,
    ControversialFilm
} from '../utils/statUtils'; 

// --- Interfaces ---
// Local interface specific to this page/component scope
interface TeamMember {
    name: string;
    title: string;
    bio: string;
    image: string;
    queue?: number; // Used for filtering active members
    color?: string; // Potentially used elsewhere, keep if needed
    interview?: { question: string; answer: string }[];
}

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

    // Memoize the calculation function for all member stats to optimize performance
    const calculateAllMemberStats = useMemo(() => {
        // Orchestrates calls to the utility function and structures data for ranking
        return (films: Film[], activeMembers: TeamMember[]): { memberName: string, stats: UserProfileStats, rankValues: MemberStatsCalculationData['rankValues'] }[] => {
            return activeMembers.map(m => {
                const memberName = m.name;
                // Calculate comprehensive stats using the utility function
                const comprehensiveStats = calculateMemberStats(memberName, films);

                // Extract the subset needed for UserProfileStats display
                const profileStats: UserProfileStats = {
                    totalSelections: comprehensiveStats.totalSelections,
                    totalRuntime: comprehensiveStats.totalRuntime,
                    avgRuntime: comprehensiveStats.avgRuntime,
                    topGenres: comprehensiveStats.topGenres,
                    avgSelectedScore: comprehensiveStats.avgSelectedScore,
                    avgGivenScore: comprehensiveStats.avgGivenScore,
                    avgDivergence: comprehensiveStats.avgDivergence,
                    avgAbsoluteDivergence: comprehensiveStats.avgAbsoluteDivergence, // Needed for ranking divergence
                    languageCount: comprehensiveStats.languageCount,
                    countryCount: comprehensiveStats.countryCount,
                } ;

                // Prepare specific values needed for ranking comparisons
                const rankValues = {
                    totalRuntime: profileStats.totalRuntime,
                    avgRuntime: profileStats.avgRuntime,
                    avgSelectedScore: profileStats.avgSelectedScore,
                    avgGivenScore: profileStats.avgGivenScore,
                    // avgDivergence: profileStats.avgDivergence, // Signed value (not directly ranked)
                    avgAbsoluteDivergence: profileStats.avgAbsoluteDivergence // Use absolute average for rank
                };

                return { memberName, stats: profileStats, rankValues } as any;
            });
        };
    }, []); // No dependencies, function logic relies on external utils/types

    // --- Data Fetching and Processing Effect ---
    useEffect(() => {
        window.scrollTo(0, 0); // Scroll to top on member change
        setLoading(true);
        setError(null);
        // Reset state variables for the new member
        setMember(null);
        setSelectedFilms([]);
        setTopRatedFilms([]);
        setMostControversialFilms([]);
        setCurrentUserStats(null);
        setRankings(null);
        setIsInterviewExpanded(false);

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

        // --- Filter and Sort Films ---

        // Films selected by the current member
        const filmsSelectedByMember = filmData
            .filter(film => film.movieClubInfo?.selector === foundMember.name)
            .sort((a, b) => { // Sort descending by watch date, then alphabetically by title
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA;
                return a.title.localeCompare(b.title);
            });
        setSelectedFilms(filmsSelectedByMember);

        // Top rated films by the current member (limit to top 6)
        const filmsRatedByMember = filmData
            .filter(film => { // Ensure the member has rated the film with a valid number
                const memberRating = film.movieClubInfo?.clubRatings.find(
                    rating => rating.user.toLowerCase() === normalizedUserName
                );
                return memberRating && typeof memberRating.score === 'number' && !isNaN(memberRating.score);
            })
            .sort((a, b) => { // Sort descending by member's score, then watch date, then title
                const ratingA = getClubRating(a, normalizedUserName)?.score ?? -Infinity; // Use -Infinity for unrated to sort them last
                const ratingB = getClubRating(b, normalizedUserName)?.score ?? -Infinity;
                if (ratingB !== ratingA) return ratingB - ratingA;
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA;
                return a.title.localeCompare(b.title);
            })
            .slice(0, 6); // Take only the top 6
        setTopRatedFilms(filmsRatedByMember);

        // --- Calculate Most Controversial Films ---
        const controversialFilmsData: ControversialFilm[] = [];
        filmData.forEach(film => {
             // Filter for valid numerical ratings only
            const validRatings = film.movieClubInfo?.clubRatings?.filter(r => r.score !== null && typeof r.score === 'number' && !isNaN(r.score));
             // Need at least two valid ratings to calculate divergence
            if (!validRatings || validRatings.length < 2) return;

            let maxAbsoluteDivergenceForFilm = -1;
            let mostDivergentUserForFilmLower = '';
             // Store details per user for this specific film to avoid recalculating averages
            let filmControversyDetails: { [userNameLower: string]: { userScore: number; othersAvg: number | null; signedDivergence: number; absoluteDivergence: number } } = {};

            validRatings.forEach(rating => {
                const currentUserScore = Number(rating.score); // Already checked for number type
                const currentUserNameLower = rating.user.toLowerCase();
                 // Find ratings by *other* users for the same film
                const otherRatingsForThisUser = validRatings.filter(r => r.user.toLowerCase() !== currentUserNameLower);

                if (otherRatingsForThisUser.length > 0) {
                     // Calculate average score from other users
                    let othersTotal = 0;
                    otherRatingsForThisUser.forEach(r => othersTotal += Number(r.score));
                    const othersAvg = othersTotal / otherRatingsForThisUser.length;
                     // Calculate signed and absolute divergence for the current user
                    const signedDivergence = currentUserScore - othersAvg;
                    const absoluteDivergence = Math.abs(signedDivergence);

                     // Store results for this user/film combination
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: othersAvg, signedDivergence: signedDivergence, absoluteDivergence: absoluteDivergence };

                     // Track the user with the largest *absolute* divergence for this film
                    if (absoluteDivergence > maxAbsoluteDivergenceForFilm) {
                        maxAbsoluteDivergenceForFilm = absoluteDivergence;
                        mostDivergentUserForFilmLower = currentUserNameLower;
                    }
                } else {
                     // Only one rating exists for the film, no divergence calculable
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: null, signedDivergence: 0, absoluteDivergence: 0 };
                }
            });

             // Check if the *profile's user* was the most divergent for *this* film
            if (mostDivergentUserForFilmLower === normalizedUserName && maxAbsoluteDivergenceForFilm > 1e-9) { // Use epsilon for float check
                const details = filmControversyDetails[normalizedUserName];
                if (details) {
                    controversialFilmsData.push({
                        filmId: film.imdbID,
                        title: film.title,
                        userScore: details.userScore,
                        othersAvgScore: details.othersAvg,
                        divergence: details.signedDivergence, // Store the signed divergence for display
                        posterUrl: film.poster,
                        watchDate: film.movieClubInfo?.watchDate as any, // Keep watch date if needed later
                        memberName: memberName
                    });
                }
            }
        });

        // Sort the collected films by the magnitude (absolute value) of divergence, descending, then by date
        controversialFilmsData.sort((a, b) => {
            const divergenceDiff = Math.abs(b.divergence) - Math.abs(a.divergence);
            if (divergenceDiff !== 0) return divergenceDiff;
            // Secondary sort by watch date if divergences are equal magnitude
            const dateA = a.watchDate ? new Date(a.watchDate).getTime() : 0;
            const dateB = b.watchDate ? new Date(b.watchDate).getTime() : 0;
            return dateB - dateA;
        });
        setMostControversialFilms(controversialFilmsData.slice(0, 4)); // Take top 4

        // --- Calculate Stats and Rankings ---
         // Filter members considered 'active' for ranking purposes (e.g., have a queue number > 0)
        const activeMembers = allTeamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        const nullRankings: UserRankings = { totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null };

        if (activeMembers.length > 0) {
            const allStatsData = calculateAllMemberStats(filmData, activeMembers);
            const currentUserData = allStatsData.find(data => data.memberName === decodedMemberName);

            if (currentUserData) {
                setCurrentUserStats(currentUserData.stats);

                // Prepare arrays of values from all *active* members for ranking
                const allTotals = allStatsData.map(d => d.rankValues.totalRuntime);
                const allAvgs = allStatsData.map(d => d.rankValues.avgRuntime);
                const allSelScores = allStatsData.map(d => d.rankValues.avgSelectedScore);
                const allGivenScores = allStatsData.map(d => d.rankValues.avgGivenScore);
                // Rank divergence based on the *absolute average* divergence (lower is better)
                const allAbsDivs = allStatsData.map(d => d.rankValues.avgAbsoluteDivergence);

                // Calculate rank strings for the current user against active members
                setRankings({
                    totalRuntimeRank: getRankString(currentUserData.rankValues.totalRuntime, allTotals, true),
                    avgRuntimeRank: getRankString(currentUserData.rankValues.avgRuntime, allAvgs, true),
                    avgSelectedScoreRank: getRankString(currentUserData.rankValues.avgSelectedScore, allSelScores, true),
                    avgGivenScoreRank: getRankString(currentUserData.rankValues.avgGivenScore, allGivenScores, true),
                    // For absolute divergence, a higher value gets a higher rank (higherIsBetter = false)
                    avgDivergenceRank: getRankString(currentUserData.rankValues.avgAbsoluteDivergence, allAbsDivs, true),
                });
            } else {
                 // Member exists but is not 'active' (e.g., queue <= 0 or undefined)
                 // Calculate their stats individually, but provide no rankings
                const inactiveMemberFullStats = calculateMemberStats(foundMember.name, filmData);
                // Extract UserProfileStats subset
                 const inactiveMemberStats: UserProfileStats = {
                     totalSelections: inactiveMemberFullStats.totalSelections,
                     totalRuntime: inactiveMemberFullStats.totalRuntime,
                     avgRuntime: inactiveMemberFullStats.avgRuntime,
                     topGenres: inactiveMemberFullStats.topGenres,
                     avgSelectedScore: inactiveMemberFullStats.avgSelectedScore,
                     avgGivenScore: inactiveMemberFullStats.avgGivenScore,
                     avgDivergence: inactiveMemberFullStats.avgDivergence,
                     avgAbsoluteDivergence: inactiveMemberFullStats.avgAbsoluteDivergence,
                     languageCount: inactiveMemberFullStats.languageCount,
                     countryCount: inactiveMemberFullStats.countryCount,
                 };
                setCurrentUserStats(inactiveMemberStats);
                setRankings(nullRankings); // No ranks as they weren't compared
            }
        } else {
             // No active members found at all in the dataset
             // Calculate stats for the single viewed member, provide no rankings
             const singleMemberFullStats = calculateMemberStats(foundMember.name, filmData);
             // Extract UserProfileStats subset
              const singleMemberStats: UserProfileStats = {
                  totalSelections: singleMemberFullStats.totalSelections,
                  totalRuntime: singleMemberFullStats.totalRuntime,
                  avgRuntime: singleMemberFullStats.avgRuntime,
                  topGenres: singleMemberFullStats.topGenres,
                  avgSelectedScore: singleMemberFullStats.avgSelectedScore,
                  avgGivenScore: singleMemberFullStats.avgGivenScore,
                  avgDivergence: singleMemberFullStats.avgDivergence,
                  avgAbsoluteDivergence: singleMemberFullStats.avgAbsoluteDivergence,
                  languageCount: singleMemberFullStats.languageCount,
                  countryCount: singleMemberFullStats.countryCount,
              };
             setCurrentUserStats(singleMemberStats);
            setRankings(nullRankings); // No ranks possible
        }

        setLoading(false); // Data loading and processing complete

    }, [memberName, calculateAllMemberStats]); // Recalculate when memberName or the memoized function changes

    // --- Render Loading State ---
    if (loading) {
        return <LoadingSpinner />;
    }

    // --- Render Error State ---
    if (error || !member) {
        // Provide a sensible default error if somehow member is null after loading and no specific error was set
        const errorMessage = error || "Could not load profile details.";
        return <ErrorDisplay message={errorMessage} backPath="/about" backButtonLabel="Back to About Page" />;
    }

    // --- Render Success State ---

    // Constants for conditional rendering and styling
    const MAX_INTERVIEW_ITEMS_BEFORE_SCROLL = 2;
    const needsInterviewExpansion = member.interview && member.interview.length > MAX_INTERVIEW_ITEMS_BEFORE_SCROLL;
    const collapsedInterviewMaxHeight = 'max-h-80'; // ~20rem, adjust as needed
    const hasEnoughControversialFilms = mostControversialFilms.length >= 1;
    // Check if there are any meaningful stats to display in the stats section
    const hasStats = currentUserStats && Object.entries(currentUserStats).some(([key, val]) =>
         // Value is non-null, non-zero (unless it's totalSelections which can be 0), or a non-empty array
        (val !== null && val !== 0 && (!Array.isArray(val) || val.length > 0))
         || (key === 'totalSelections' && val === 0) // Explicitly allow totalSelections: 0
    );

    return (
        <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back button */}
                <button
                    onClick={() => navigate(-1)} // Navigate back in history
                    className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                >
                    <ChevronLeftIcon className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" aria-hidden="true" />
                    Back
                </button>

                {/* Profile Header Section */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <div className="py-12 sm:p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-10 md:space-x-16">
                        <CircularImage
                           src={member.image}
                           alt={member.name}
                           size="w-36 h-36 sm:w-40 sm:h-40 md:w-48 md:h-48" // Responsive sizing
                           className="flex-shrink-0 border-2 border-slate-600 mb-4 !sm:mb-6 sm:mb-0 shadow-lg"
                        />
                        <div className="text-center sm:text-left flex-grow min-w-0 sm:ml-8 sm:mt-2"> {/* Ensure text truncates if needed */}
                            <h1 className="text-3xl sm:text-4xl text-slate-100 mb-2 break-words font-thin">{member.name}</h1>
                            <p className="text-lg text-blue-400/90 mb-4">{member.title}</p>
                            {/* Render bio using ReactMarkdown for potential formatting */}
                            <div className="text-slate-300 leading-relaxed max-w-xl mx-auto sm:mx-0 prose prose-sm prose-invert max-w-none">
                                <ReactMarkdown>{member.bio}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interview Section (Conditional) */}
                {member.interview && member.interview.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                        <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3"> Interview </h3>
                        {/* Container for expand/collapse animation */}
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isInterviewExpanded && needsInterviewExpansion ? collapsedInterviewMaxHeight : 'max-h-[1500px]'}`}>
                             {/* Inner container for potential scrollbar padding */}
                             <div className={`pr-2 -mr-2 ${!isInterviewExpanded && needsInterviewExpansion ? 'overflow-y-auto ' + collapsedInterviewMaxHeight : ''}`}>
                                <div className="divide-y divide-slate-700">
                                     {/* Map over interview items */}
                                    {member.interview.map((item, index) => <InterviewItem key={index} question={item.question} answer={item.answer} />)}
                                </div>
                            </div>
                        </div>
                         {/* Expander button */}
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

                {/* Combined Stats and Divergence Section (Grid Layout) */}
                {/* Render this grid container only if there are stats OR controversial films to show */}
                {(hasStats || hasEnoughControversialFilms) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                         {/* Member Stats Column (takes 2 cols on large screens) */}
                         {/* Render stats section only if hasStats is true */}
                        <div className={`lg:col-span-2 ${!hasStats ? 'hidden lg:block' : ''}`}> {/* Use block only if hiding on large screens */}
                            {hasStats ? (
                                <ProfileStatsSection stats={currentUserStats} rankings={rankings} />
                            ) : (
                                 /* Optional: Render an empty placeholder on large screens if only divergence exists,
                                    to maintain the 3-column grid structure. Otherwise, divergence section will take full width below lg. */
                                 <div className="hidden lg:block lg:col-span-2"></div>
                             )}
                        </div>

                         {/* Most Divergent Scores Column (takes 1 col on large screens) */}
                         {/* Render controversial films section only if hasEnoughControversialFilms is true */}
                        {hasEnoughControversialFilms && (
                            <div className="lg:col-span-1">
                                <div className="p-6 bg-slate-700/50 border border-slate-700 rounded-lg shadow-md h-full"> {/* Add h-full for consistent height in grid */}
                                    <h4 className="text-lg font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-600/50">
                                        Most Divergent Scores
                                    </h4>
                                    <div className="space-y-3"> {/* Add slightly more space */}
                                        {mostControversialFilms.map((film) => (
                                            <ControversialFilmItem key={film.filmId} film={film} />
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-4 text-center italic"> {/* Increased margin-top */}
                                        Films where {member.name} had the largest score difference (magnitude) from the club average.
                                    </p>
                                </div>
                            </div>
                        )}
                        {/* Optional: Placeholder for grid structure if only stats exist on large screens */}
                        {!hasEnoughControversialFilms && hasStats && (
                             <div className="lg:col-span-1 hidden lg:block"></div>
                         )}
                    </div>
                )}


                {/* Top Rated Films Section (Full Width, Conditional) */}
                {topRatedFilms.length > 0 && (
                    <div className="mb-12 mt-8"> {/* Consistent margin */}
                        <FilmList
                            films={topRatedFilms}
                            title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                            // Pass additional props to FilmList if needed
                        />
                    </div>
                )}

                {/* Selected Films Section (Full Width, Conditional) */}
                {selectedFilms.length > 0 ? (
                    <div className="mb-12 mt-8"> {/* Consistent margin */}
                        <FilmList
                            films={selectedFilms}
                            title={`Films Selected by ${member.name}`}
                            // Pass additional props to FilmList if needed
                        />
                    </div>
                ) : (
                    // Show message if no films selected AND the stats card doesn't explicitly show "0 selections"
                    // This avoids redundancy if the stat card already indicates zero.
                    (!currentUserStats || currentUserStats.totalSelections === null || currentUserStats.totalSelections < 0) && (
                        <div className="text-center py-8 text-slate-400 italic mt-8">
                            {member.name} hasn't selected any films yet.
                        </div>
                    )
                )}

            </div>
        </div>
    );
};

export default ProfilePage;