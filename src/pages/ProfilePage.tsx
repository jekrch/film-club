import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
// --- Import Heroicons ---
import {
    FilmIcon,
    ClockIcon,
    PencilSquareIcon, // Updated from PencilAltIcon (v1)
    LanguageIcon, // Updated from TranslateIcon (v1)
    MapPinIcon, // Updated from LocationMarkerIcon (v1)
    TagIcon,
    // UsersIcon, // Example, could use for ranks or general user stats (Keep if planning use)
    HashtagIcon, // For ranks
    TrophyIcon, // For ranks / scores
    ArrowsRightLeftIcon // For divergence/difference
} from '@heroicons/react/24/outline'; // Using Outline icons v2

import CircularImage from '../components/common/CircularImage';
import FilmList from '../components/films/FilmList';
import { teamMembers as allTeamMembers } from '../types/team';
import { Film, getClubRating, filmData, ClubRating } from '../types/film';
import { calculateClubAverage } from '../utils/ratingUtils'; // Assuming this exists and works like Almanac

// --- Interfaces ---
interface TeamMember {
    name: string;
    title: string;
    bio: string;
    image: string;
    queue?: number;
    color?: string;
    interview?: { question: string; answer: string }[];
}

interface InterviewItemProps {
    question: string;
    answer: string;
}

// Define the structure for the calculated stats for a single user
interface UserProfileStats {
    totalSelections: number;
    totalRuntime: number | null;
    avgRuntime: number | null;
    topGenres: { genre: string; count: number }[];
    avgSelectedScore: number | null; // Avg club score of films *they* selected (min 2 ratings)
    avgGivenScore: number | null;      // Avg score *they* gave to *any* club film
    avgDivergence: number | null;      // Avg divergence from others' scores (min 2 total ratings)
    languageCount: number;
    countryCount: number;
}

// Define the structure for rankings
interface UserRankings {
    totalRuntimeRank: string | null;
    avgRuntimeRank: string | null;
    avgSelectedScoreRank: string | null;
    avgGivenScoreRank: string | null;
    avgDivergenceRank: string | null; // Rank for divergence (lower is better)
}

// Combined type for all member stats calculation
interface MemberStatsCalculationData {
    memberName: string;
    stats: UserProfileStats;
    rankValues: { // Raw values used for ranking comparisons
        totalRuntime: number | null;
        avgRuntime: number | null;
        avgSelectedScore: number | null;
        avgGivenScore: number | null;
        avgDivergence: number | null; // Raw divergence value for ranking
    };
}

// Interface for a controversial film entry
interface ControversialFilm {
    filmId: string; // Use imdbID for unique key
    title: string;
    userScore: number;
    othersAvgScore: number | null;
    divergence: number;
    posterUrl?: string; // Optional: for display
    watchDate?: string; // Optional: for context
}


// --- Helper Functions (Adapted/Simplified from Almanac potentially) ---

// Parses runtime string "X min" to number of minutes
const parseRuntime = (runtime: string | undefined | null): number | null => {
    if (!runtime || typeof runtime !== 'string') return null;
    const minutes = parseInt(runtime.replace(/[^0-9]/g, ''), 10);
    return !isNaN(minutes) ? minutes : null;
};

// Formats total minutes into a more readable string (e.g., "X hrs Y min")
// Returns null if input is null, NaN, or <= 0
const formatTotalRuntime = (totalMinutes: number | null): string | null => {
    if (totalMinutes === null || isNaN(totalMinutes) || totalMinutes <= 0) return null; // Changed to return null for hiding
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    let result = '';
    if (hours > 0) {
        result += `${hours} hr${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
        if (result) result += ' ';
        result += `${minutes} min`;
    }
    return result; // Removed || '0 min'
};

// Formats average values
// Returns null if input is null, undefined, or NaN
const formatAverage = (avg: number | null | undefined, digits = 1): string | null => {
    if (avg === null || avg === undefined || isNaN(avg)) return null; // Changed to return null for hiding
    return avg.toFixed(digits);
};

// Counts valid numeric ratings for a film
const countValidRatings = (clubRatings: ClubRating[] | undefined): number => {
    if (!clubRatings || !Array.isArray(clubRatings)) return 0;
    return clubRatings.filter(rating => rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score as number)).length;
};

// Calculates rank string (e.g., "1 of 10") - Changed format slightly
const getRankString = (
    value: number | null,
    allValues: (number | null)[],
    higherIsBetter: boolean = true
): string | null => {
    if (value === null || isNaN(value)) return null;

    const validValues = allValues
        .filter((v): v is number => v !== null && !isNaN(v))
        .sort((a, b) => (higherIsBetter ? b - a : a - b)); // Sort based on preference

    if (validValues.length < 2) return null; // Not enough data to rank

    const rank = validValues.findIndex(v => v === value) + 1;

    if (rank === 0) return null; // Value not found among valid values (shouldn't happen with filter)

    // Return only the rank and total, formatting handled in card
    return `${rank}/${validValues.length}`;
};


// --- Components ---

const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Threshold reduced for demonstration, adjust as needed
    const needsExpander = answer.length > 200; // Show expander for shorter answers too if desired

    return (
        <div className="py-5">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">{question}</h4>
            <div className={`prose prose-sm prose-invert max-w-none text-slate-300 ${!isExpanded && needsExpander ? 'line-clamp-4' : ''}`}>
                <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
            {needsExpander && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2"
                >
                    {isExpanded ? 'Read Less' : 'Read More'}
                </button>
            )}
        </div>
    );
};

// Stat Card Component for Profile Page - Updated with Icon Support
interface ProfileStatCardProps {
    label: string;
    value: string | number; // Value MUST be pre-formatted string or number
    rank?: string | null; // Expects "X/Y" format now
    description?: string;
    valueClassName?: string;
    icon?: React.ElementType; // Optional icon component (e.g., Heroicon)
}

const ProfileStatCard: React.FC<ProfileStatCardProps> = ({
    label,
    value,
    rank,
    description,
    valueClassName = "text-slate-100",
    icon: IconComponent // Rename prop for clarity
}) => {
    // Do not render the card if the value is null, undefined, empty string, or explicitly 'N/A'
    if (value === null || value === undefined || value === '' || value === 'N/A') {
        return null;
    }

    let rankDisplay = null;
    if (rank && typeof rank === 'string' && rank.includes('/')) {
        const [rankNum, totalNum] = rank.split('/');
        rankDisplay = (
            <span className="text-sm font-normal text-slate-400 ml-2 whitespace-nowrap">
                <HashtagIcon className="inline h-3 w-3 mr-0.5 relative -top-px" />{rankNum}
                <span className="text-xs"> of {totalNum}</span>
            </span>
        );
    }


    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-col justify-between shadow-md hover:shadow-lg hover:border-slate-600 transition-all duration-200 min-h-[120px]"> {/* Increased min-height slightly */}
            <div>
                {/* Label Row with Icon */}
                <div className="flex items-center text-sm font-medium text-blue-300/80 mb-2">
                    {IconComponent && <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" aria-hidden="true" />}
                    <h4 className="truncate" title={label}>{label}</h4> {/* Added truncate and title */}
                </div>
                {/* Value Row */}
                <p className={`text-2xl xl:text-3xl font-semibold ${valueClassName} break-words`}> {/* Added break-words */}
                    {value}
                    {rankDisplay}
                </p>
            </div>
             {/* Description Row */}
             {description && (
                <p className="text-xs text-slate-400/80 mt-2">
                    {description}
                </p>
            )}
        </div>
    );
};


// Section to Display All Calculated Stats - Updated with Icons and Conditional Rendering
interface ProfileStatsSectionProps {
    stats: UserProfileStats | null;
    rankings: UserRankings | null;
}

// Define structure for stat card configuration
interface StatCardConfig {
    id: keyof UserProfileStats | 'topGenresString'; // Unique key identifier
    label: string;
    getValue: (stats: UserProfileStats) => number | string | null | { genre: string; count: number }[];
    formatValue: (value: any) => string | number | null; // Format raw value for display, return null if not applicable
    getRank?: (rankings: UserRankings) => string | null;
    description?: string;
    icon: React.ElementType;
    valueClassName?: string | ((rank: string | null) => string);
}


const ProfileStatsSection: React.FC<ProfileStatsSectionProps> = ({ stats, rankings }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_VISIBLE_CARDS_COLLAPSED = 8; // Increased default visible

    // Define all potential stat cards
    const statCardDefinitions: StatCardConfig[] = useMemo(() => [
        {
            id: 'totalSelections',
            label: "Films Selected",
            getValue: (s) => s.totalSelections,
            formatValue: (v) => (v !== null && v > 0 ? v : null), // Hide if 0 or null
            icon: FilmIcon,
        },
        {
            id: 'totalRuntime',
            label: "Total Runtime (Selected)",
            getValue: (s) => s.totalRuntime,
            formatValue: formatTotalRuntime, // Already returns null if 0 or null
            getRank: (r) => r.totalRuntimeRank,
            description: "Total duration of selected films.",
            icon: ClockIcon,
        },
        {
            id: 'avgRuntime',
            label: "Avg. Runtime (Selected)",
            getValue: (s) => s.avgRuntime,
            formatValue: (v) => {
                const formatted = formatAverage(v, 0);
                return formatted ? `${formatted} min` : null; // Append " min" only if value exists
            },
            getRank: (r) => r.avgRuntimeRank,
            description: "Average duration per selected film.",
            icon: ClockIcon, // Could use a different one
        },
        {
            id: 'avgSelectedScore',
            label: "Avg. Club Score (Selected)",
            getValue: (s) => s.avgSelectedScore,
            formatValue: (v) => formatAverage(v, 2), // Returns null if not applicable
            getRank: (r) => r.avgSelectedScoreRank,
            description: "Avg. score on selected films (min. 2 ratings).",
            icon: TrophyIcon,
        },
        {
            id: 'avgGivenScore',
            label: "Avg. Score Given",
            getValue: (s) => s.avgGivenScore,
            formatValue: (v) => formatAverage(v, 2), // Returns null if not applicable
            getRank: (r) => r.avgGivenScoreRank,
            description: "Avg. score given to any club film.",
            icon: PencilSquareIcon,
        },
        { // NEW STAT: Average Score Divergence
             id: 'avgDivergence',
             label: "Avg. Score Divergence",
             getValue: (s) => s.avgDivergence,
             formatValue: (v) => formatAverage(v, 2), // Format to 2 decimal places
             getRank: (r) => r.avgDivergenceRank,
             description: "Avg. difference from others' scores.",
             icon: ArrowsRightLeftIcon, // Icon indicating difference or exchange
        },
        {
            id: 'languageCount',
            label: "Unique Languages (Selected)",
            getValue: (s) => s.languageCount,
            formatValue: (v) => (v !== null && v > 0 ? v : null), // Hide if 0 or null
            description: "Primary languages of selected films.",
            icon: LanguageIcon,
        },
        {
            id: 'countryCount',
            label: "Unique Countries (Selected)",
            getValue: (s) => s.countryCount,
            formatValue: (v) => (v !== null && v > 0 ? v : null), // Hide if 0 or null
            description: "Primary countries of selected films.",
            icon: MapPinIcon,
        },
        {
            id: 'topGenresString', // Special case for genres
            label: "Top Genres (Selected)",
            getValue: (s) => s.topGenres,
            formatValue: (genres) => {
                if (!genres || genres.length === 0) return null; // Hide if no genres
                return genres.map((g: any) => `${g.genre} (${g.count})`).join(', ');
            },
            valueClassName: "text-lg leading-snug", // Adjust text size/leading
            description: "Most frequently selected genres.",
            icon: TagIcon,
        },
    ], []); // Dependencies are stable functions/icons


    // Filter and prepare the cards to be rendered
    const visibleStatCards = useMemo(() => {
        if (!stats) return [];

        return statCardDefinitions
            .map(config => {
                const rawValue = config.getValue(stats);
                const formattedValue = config.formatValue(rawValue);
                const rank = (config.getRank && rankings) ? config.getRank(rankings) : null;

                // Determine class name, handling function type
                let className = "text-slate-100"; // Default
                if (typeof config.valueClassName === 'function') {
                    className = config.valueClassName(rank);
                } else if (typeof config.valueClassName === 'string') {
                    className = config.valueClassName;
                }


                return {
                    ...config,
                    displayValue: formattedValue,
                    displayRank: rank,
                    displayClassName: className,
                };
            })
            // Filter out cards where formatValue returned null (meaning not applicable)
            .filter(card => card.displayValue !== null);

    }, [stats, rankings, statCardDefinitions]);


    // If no stats are available or all stats are filtered out, hide the section
    if (!stats || visibleStatCards.length === 0) {
        // Optionally return a message or just null
        // return <div className="text-slate-400 text-center py-4">No applicable stats available.</div>;
        return null; // Hide section completely
    }


    const needsExpansion = visibleStatCards.length > MAX_VISIBLE_CARDS_COLLAPSED;
    // Adjust max-height based on the number of rows needed for MAX_VISIBLE_CARDS_COLLAPSED and grid layout
    // Assuming 4 cols (xl): 8 cards = 2 rows. ~120px height + 16px gap = ~256px. Let's use slightly more.
    const collapsedMaxHeight = 'max-h-72'; // Adjusted height for new card size (or keep if flexible enough)


    return (
        <div className="bg-slate-800 rounded-lg p-6 md:p-8 mb-8 mt-8 border border-slate-700 shadow-xl shadow-slate-950/30">
            <h3 className="text-2xl font-bold text-slate-100 mb-5 border-b border-slate-700 pb-3">
                Member Stats
            </h3>
            {/* Use visibleStatCards.length for conditional classes */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isExpanded && needsExpansion ? collapsedMaxHeight : 'max-h-[1000px]'}`}>
                 <div className={` ${!isExpanded && needsExpansion ? 'overflow-y-auto ' + collapsedMaxHeight : ''} pr-2 -mr-2`}> {/* Offset padding for scrollbar */}
                     {/* Map over the *filtered* and *prepared* list of cards */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                         {visibleStatCards.map((card) => (
                             <ProfileStatCard
                                 key={card.id} // Use the unique ID from config
                                 label={card.label}
                                 value={card.displayValue!} // Assert non-null as we filtered
                                 rank={card.displayRank}
                                 description={card.description}
                                 icon={card.icon}
                                 valueClassName={card.displayClassName}
                             />
                         ))}
                     </div>
                </div>
            </div>
            {/* Expander Button - only show if needed based on visible cards */}
            {needsExpansion && (
                 <div className="mt-4 text-center border-t border-slate-700 pt-4">
                     <button
                         onClick={() => setIsExpanded(!isExpanded)}
                         className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center"
                     >
                         {isExpanded ? (
                             <>
                                 Show Less Stats
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                     <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                 </svg>
                             </>
                         ) : (
                             <>
                                 Show All Stats ({visibleStatCards.length} total) {/* Optionally show count */}
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                     <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                 </svg>
                             </>
                         )}
                     </button>
                </div>
             )}
        </div>
    );
};

// --- Component for Controversial Film Item ---
interface ControversialFilmItemProps {
    film: ControversialFilm;
}

const ControversialFilmItem: React.FC<ControversialFilmItemProps> = ({ film }) => {
    const navigate = useNavigate();

    const handleNavigate = () => {
        navigate(`/films/${film.filmId}`); // Navigate to film details page
    };

    return (
        <div
            className="flex items-center space-x-4 p-3 bg-slate-800/40 hover:bg-slate-700/60 rounded-md transition-colors duration-150 cursor-pointer"
            onClick={handleNavigate}
            title={`View ${film.title}`}
        >
            {film.posterUrl && film.posterUrl !== 'N/A' && (
                <img src={film.posterUrl} alt={film.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
            )}
            {!film.posterUrl || film.posterUrl === 'N/A' && (
                 <div className="w-10 h-14 bg-slate-700 rounded flex-shrink-0 flex items-center justify-center">
                     <FilmIcon className="h-6 w-6 text-slate-500"/>
                 </div>
             )}
            <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{film.title}</p>
                <p className="text-xs text-slate-400">
                    Their score: <span className="font-semibold text-blue-400">{film.userScore.toFixed(1)}</span>
                    {' / '}
                    Others' avg: <span className="font-semibold text-amber-400">{film.othersAvgScore !== null ? film.othersAvgScore.toFixed(1) : 'N/A'}</span>
                </p>
            </div>
            <div className="text-right flex-shrink-0 ml-auto pl-2">
                <p className="text-xs text-slate-400">Divergence</p>
                <p className="text-lg font-semibold text-red-400">{film.divergence.toFixed(1)}</p>
            </div>
        </div>
    );
};


// --- Main Profile Page Component ---

const ProfilePage: React.FC = () => {
    const { memberName } = useParams<{ memberName: string }>();
    const navigate = useNavigate();
    const [member, setMember] = useState<TeamMember | null>(null);
    const [selectedFilms, setSelectedFilms] = useState<Film[]>([]);
    const [topRatedFilms, setTopRatedFilms] = useState<Film[]>([]);
    const [mostControversialFilms, setMostControversialFilms] = useState<ControversialFilm[]>([]); // State for controversial films
    const [currentUserStats, setCurrentUserStats] = useState<UserProfileStats | null>(null);
    const [rankings, setRankings] = useState<UserRankings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isInterviewExpanded, setIsInterviewExpanded] = useState(false); // State for interview expansion
    const [error, setError] = useState<string | null>(null);

    // Memoize the calculation function for all member stats
    const calculateAllMemberStats = useMemo(() => {
        return (films: Film[], activeMembers: TeamMember[]): MemberStatsCalculationData[] => {
            return activeMembers.map(m => {
                const memberName = m.name;
                const normalizedUserName = memberName.toLowerCase();

                // 1. Films Selected by this member
                const userSelections = films.filter(film => film.movieClubInfo?.selector === memberName);
                const totalSelections = userSelections.length;

                // 2. Total & Avg Runtime (Selected)
                let totalRuntime = 0;
                let runtimeCount = 0;
                userSelections.forEach(film => {
                    const rt = parseRuntime(film.runtime);
                    if (rt !== null) {
                        totalRuntime += rt;
                        runtimeCount++;
                    }
                });
                const avgRuntime = runtimeCount > 0 ? totalRuntime / runtimeCount : null;

                // 3. Top 3 Genres (Selected)
                const genreCounts: { [key: string]: number } = {};
                userSelections.forEach(film => {
                    if (film.genre) {
                        film.genre.split(',').forEach(g => {
                            const trimmedGenre = g.trim();
                            if (trimmedGenre && trimmedGenre !== "N/A") {
                                genreCounts[trimmedGenre] = (genreCounts[trimmedGenre] || 0) + 1;
                            }
                        });
                    }
                });
                const sortedGenres = Object.entries(genreCounts)
                    .sort(([, countA], [, countB]) => countB - countA)
                    .slice(0, 3)
                    .map(([genre, count]) => ({ genre, count }));

                // 4. Avg Club Score (Selected, min 2 ratings)
                let totalSelectedScore = 0;
                let selectedScoreCount = 0;
                userSelections.forEach(film => {
                    const validRatingCount = countValidRatings(film.movieClubInfo?.clubRatings);
                    if (validRatingCount >= 2) {
                        const avg = calculateClubAverage(film.movieClubInfo?.clubRatings); // Assumes this helper exists
                        if (avg !== null && !isNaN(avg)) {
                            totalSelectedScore += avg;
                            selectedScoreCount++;
                        }
                    }
                });
                const avgSelectedScore = selectedScoreCount > 0 ? totalSelectedScore / selectedScoreCount : null;

                // 5. Avg Score Given & Avg Divergence Calculation
                let totalGivenScore = 0;
                let givenScoreCount = 0;
                let totalDivergence = 0;
                let divergenceCount = 0;

                films.forEach(film => {
                    const ratings = film.movieClubInfo?.clubRatings;
                    if (ratings && Array.isArray(ratings)) {
                        const userRatingEntry = ratings.find(r => r.user.toLowerCase() === normalizedUserName);
                        const userScore = (userRatingEntry && userRatingEntry.score !== null && !isNaN(Number(userRatingEntry.score)))
                            ? Number(userRatingEntry.score)
                            : null;

                        // Calculate Avg Score Given
                        if (userScore !== null) {
                            totalGivenScore += userScore;
                            givenScoreCount++;
                        }

                        // Calculate Divergence
                        const otherRatings = ratings.filter(r =>
                            r.user.toLowerCase() !== normalizedUserName &&
                            r.score !== null &&
                            typeof r.score === 'number' &&
                            !isNaN(r.score)
                        );

                        if (userScore !== null && otherRatings.length > 0) { // Need user score and at least one other score
                            let othersTotal = 0;
                            otherRatings.forEach(r => othersTotal += (r.score as number));
                            const othersAvg = othersTotal / otherRatings.length;
                            const divergence = Math.abs(userScore - othersAvg);

                            totalDivergence += divergence;
                            divergenceCount++;
                        }
                    }
                });

                const avgGivenScore = givenScoreCount > 0 ? totalGivenScore / givenScoreCount : null;
                const avgDivergence = divergenceCount > 0 ? totalDivergence / divergenceCount : null;


                // 6. Language Count (Selected)
                const languages = new Set<string>();
                userSelections.forEach(film => {
                    if (film?.language?.trim() && film.language !== "N/A") {
                        languages.add(film.language.split(',')[0].trim());
                    }
                });
                const languageCount = languages.size;

                // 7. Country Count (Selected)
                const countries = new Set<string>();
                userSelections.forEach(film => {
                    if (film?.country?.trim() && film.country !== "N/A") {
                        countries.add(film.country.split(',')[0].trim());
                    }
                });
                const countryCount = countries.size;

                const stats: UserProfileStats = {
                    totalSelections,
                    totalRuntime: totalRuntime > 0 ? totalRuntime : null,
                    avgRuntime,
                    topGenres: sortedGenres,
                    avgSelectedScore,
                    avgGivenScore,
                    avgDivergence, // Added divergence stat
                    languageCount,
                    countryCount,
                };

                const rankValues = {
                    totalRuntime: stats.totalRuntime,
                    avgRuntime: stats.avgRuntime,
                    avgSelectedScore: stats.avgSelectedScore,
                    avgGivenScore: stats.avgGivenScore,
                    avgDivergence: stats.avgDivergence, // Added divergence for ranking
                };

                return { memberName, stats, rankValues };
            });
        };
    }, []); // Empty dependency array

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        setError(null);
        setMember(null);
        setSelectedFilms([]);
        setTopRatedFilms([]);
        setMostControversialFilms([]); // Reset controversial films
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

        // --- Filter films selected by this member ---
        const filmsSelectedByMember = filmData
            .filter(film => film.movieClubInfo?.selector === foundMember.name)
            .sort((a, b) => {
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA; // Most recent first
                return a.title.localeCompare(b.title);
            });

        setSelectedFilms(filmsSelectedByMember);

        // --- Calculate Top Rated Films by this member ---
        const filmsRatedByMember = filmData
            .filter(film => {
                const memberRating = film.movieClubInfo?.clubRatings.find(
                    rating => rating.user.toLowerCase() === normalizedUserName
                );
                return memberRating && typeof memberRating.score === 'number' && !isNaN(memberRating.score);
            })
            .sort((a, b) => {
                const ratingA = getClubRating(a, normalizedUserName)?.score ?? 0;
                const ratingB = getClubRating(b, normalizedUserName)?.score ?? 0;
                if (ratingB !== ratingA) return ratingB - ratingA;
                return a.title.localeCompare(b.title);
            })
            .slice(0, 4); // Get top 4

        setTopRatedFilms(filmsRatedByMember);

        // --- Calculate Top 4 Most Controversial Films (User was *most* divergent) ---
        const controversialFilmsData: ControversialFilm[] = [];
        filmData.forEach(film => {
            const validRatings = film.movieClubInfo?.clubRatings?.filter(r =>
                r.score !== null && typeof r.score === 'number' && !isNaN(r.score)
            ); // Get only valid, numeric ratings

            // Need at least two ratings (one user and one other) to calculate divergence
            if (!validRatings || validRatings.length < 2) {
                return; // Skip this film
            }

            let maxDivergence = -1;
            let mostDivergentUserLower = '';
            let filmControversyDetails: { [userNameLower: string]: { userScore: number; othersAvg: number | null; divergence: number } } = {};

            // Calculate divergence for each user who rated this film
            validRatings.forEach(rating => {
                const currentUserScore = Number(rating.score); // Already filtered for valid numbers
                const currentUserNameLower = rating.user.toLowerCase();

                // Calculate average of OTHERS for this specific user
                const otherRatingsForThisUser = validRatings.filter(r => r.user.toLowerCase() !== currentUserNameLower);

                if (otherRatingsForThisUser.length > 0) {
                    let othersTotal = 0;
                    otherRatingsForThisUser.forEach(r => othersTotal += Number(r.score));
                    const othersAvg = othersTotal / otherRatingsForThisUser.length;
                    const divergence = Math.abs(currentUserScore - othersAvg);

                    // Store details for potential use later
                    filmControversyDetails[currentUserNameLower] = {
                        userScore: currentUserScore,
                        othersAvg: othersAvg,
                        divergence: divergence
                    };

                    // Track the maximum divergence and the user who caused it
                    // In case of a tie, the first user encountered with the max divergence is recorded.
                    if (divergence > maxDivergence) {
                        maxDivergence = divergence;
                        mostDivergentUserLower = currentUserNameLower;
                    }
                } else {
                    // This user was the *only* one who rated it. Divergence is not applicable.
                    filmControversyDetails[currentUserNameLower] = {
                        userScore: currentUserScore,
                        othersAvg: null, // No others to average
                        divergence: 0 // No divergence if no others
                    };
                }
            });

            // Check if the *profile user* was the *most divergent* user for this film
            if (mostDivergentUserLower === normalizedUserName && maxDivergence > 0) { // Ensure profile user was most divergent and divergence > 0
                 const profileUserDetails = filmControversyDetails[normalizedUserName];
                 if (profileUserDetails) { // Should always exist if mostDivergentUser matched
                     controversialFilmsData.push({
                         filmId: film.imdbID,
                         title: film.title,
                         userScore: profileUserDetails.userScore, // The profile user's actual score
                         othersAvgScore: profileUserDetails.othersAvg, // Avg of others relative to the profile user
                         divergence: profileUserDetails.divergence, // The profile user's (max) divergence for this film
                         posterUrl: film.poster,
                         watchDate: film.movieClubInfo?.watchDate as any
                     });
                }
            }
        });

        // Sort by divergence descending and take top 4
        controversialFilmsData.sort((a, b) => b.divergence - a.divergence);
        setMostControversialFilms(controversialFilmsData.slice(0, 4));


        // --- Calculate All Stats and Rankings ---
        const activeMembers = allTeamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        if (activeMembers.length > 0) {
            const allStatsData = calculateAllMemberStats(filmData, activeMembers);

            const currentUserData = allStatsData.find(data => data.memberName === decodedMemberName);
            if (currentUserData) {
                setCurrentUserStats(currentUserData.stats);

                const allTotalRuntimes = allStatsData.map(d => d.rankValues.totalRuntime);
                const allAvgRuntimes = allStatsData.map(d => d.rankValues.avgRuntime);
                const allAvgSelectedScores = allStatsData.map(d => d.rankValues.avgSelectedScore);
                const allAvgGivenScores = allStatsData.map(d => d.rankValues.avgGivenScore);
                const allAvgDivergences = allStatsData.map(d => d.rankValues.avgDivergence); // Get all divergence values

                setRankings({
                    totalRuntimeRank: getRankString(currentUserData.rankValues.totalRuntime, allTotalRuntimes, true),
                    avgRuntimeRank: getRankString(currentUserData.rankValues.avgRuntime, allAvgRuntimes, true),
                    avgSelectedScoreRank: getRankString(currentUserData.rankValues.avgSelectedScore, allAvgSelectedScores, true),
                    avgGivenScoreRank: getRankString(currentUserData.rankValues.avgGivenScore, allAvgGivenScores, true),
                    avgDivergenceRank: getRankString(currentUserData.rankValues.avgDivergence, allAvgDivergences, true), // higher divergence is better for ranking
                });
            } else {
                // Calculate stats for inactive member, no ranks
                const inactiveMemberData = calculateAllMemberStats(filmData, [foundMember]);
                if (inactiveMemberData.length > 0) {
                    setCurrentUserStats(inactiveMemberData[0].stats);
                }
                setRankings({ totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null });
            }
        } else {
            // No active members, calculate stats just for this user
            const singleMemberData = calculateAllMemberStats(filmData, [foundMember]);
            if (singleMemberData.length > 0) {
                setCurrentUserStats(singleMemberData[0].stats);
            }
            setRankings({ totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null });
        }


        setLoading(false);

    }, [memberName, calculateAllMemberStats]); // Dependency on calculation function

    // --- Loading State ---
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-slate-900">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            </div>
        );
    }

    // --- Error State ---
    if (error || !member) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-slate-900 text-slate-300 min-h-[calc(100vh-200px)]">
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded relative mb-6 inline-block" role="alert">
                    <strong className="font-bold block sm:inline">Error: </strong>
                    <span className="block sm:inline">{error || "Could not load profile details."}</span>
                </div>
                <div>
                    <button onClick={() => navigate('/about')} className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium">
                        Back to About Page
                    </button>
                </div>
            </div>
        );
    }

    // --- Success State ---

    // Determine if interview needs expander
    const MAX_INTERVIEW_ITEMS_BEFORE_SCROLL = 2;
    const needsInterviewExpansion = member.interview && member.interview.length > MAX_INTERVIEW_ITEMS_BEFORE_SCROLL;
    const collapsedInterviewMaxHeight = 'max-h-80'; // Adjust based on typical InterviewItem height
    const hasEnoughControversialFilms = mostControversialFilms.length >= 1; // Condition changed to show if at least one exists

    return (
        <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back button */}
                <button onClick={() => navigate(-1)} className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    Back
                </button>

                {/* Profile Header Section */}
                <div className="bg-slate-800x bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden mb-2 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <div className="p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-16">
                        <CircularImage
                            src={member.image}
                            alt={member.name}
                            size="w-52 h-52 sm:w-42 sm:h-42" // Consider making consistent or using profile var?
                            className="flex-shrink-0 border-2 border-slate-600 mb-6 sm:mb-0"
                        />
                        <div className="text-center sm:text-left sm:ml-10 flex-grow min-w-0">
                            <h1 className="text-3xl sm:text-4xl font- text-slate-100 mb-2">{member.name}</h1>
                            <p className="text-lg text-blue-400/90 mb-4">{member.title}</p>
                            <div className="text-slate-300 leading-relaxed max-w-xl mx-auto sm:mx-0 prose prose-sm prose-invert max-w-none">
                                <ReactMarkdown>{member.bio}</ReactMarkdown> {/* Render bio as Markdown */}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interview Section */}
                {member.interview && member.interview.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 mt-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                        <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3">
                            Interview
                        </h3>
                        {/* Wrapper for controlling height and overflow */}
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isInterviewExpanded && needsInterviewExpansion ? collapsedInterviewMaxHeight : 'max-h-[1500px]'}`}> {/* Large max-h for expanded state */}
                            {/* Inner wrapper for scrolling content */}
                            <div className={`${!isInterviewExpanded && needsInterviewExpansion ? 'overflow-y-auto ' + collapsedInterviewMaxHeight : ''} pr-2 -mr-2`}> {/* Offset padding */}
                                <div className="divide-y divide-slate-700">
                                    {member.interview.map((item, index) => (
                                        <InterviewItem key={index} question={item.question} answer={item.answer} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Expander Button */}
                        {needsInterviewExpansion && (
                            <div className="mt-4 text-center border-t border-slate-700 pt-4">
                                <button
                                    onClick={() => setIsInterviewExpanded(!isInterviewExpanded)}
                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center"
                                >
                                    {isInterviewExpanded ? (
                                        <>
                                            Show Less
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                            </svg>
                                        </>
                                    ) : (
                                        <>
                                            Show Full Interview
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                 {/* --- PROFILE STATS SECTION --- */}
                 {/* The section itself will return null if no stats are visible */}
                <ProfileStatsSection stats={currentUserStats} rankings={rankings} />
                 {/* --- STATS SECTION END --- */}



                {/* Top Rated / Controversial Section Container */}
                {(topRatedFilms.length > 0 || hasEnoughControversialFilms) && (
                    <div className="mb-12 mt-8">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                            {/* Top Rated Films Column (Takes 2/3 width on large screens) */}
                            {topRatedFilms.length > 0 && (
                                <div className="lg:col-span-2">
                                    <FilmList
                                        films={topRatedFilms}
                                        title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                                        //compact={false} // Use standard FilmList display
                                    />
                                </div>
                            )}

                            {/* Controversial Scores Column (Takes 1/3 width on large screens) */}
                            {hasEnoughControversialFilms && (
                                <div className={`lg:col-span-1 ${topRatedFilms.length === 0 ? 'lg:col-start-2' : ''}`}> {/* Adjust positioning if top rated is empty */}
                                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg shadow-md h-full"> {/* Added h-full */}
                                        <h4 className="text-lg font-semibold text-slate-200 mb-3 pb-2 border-b border-slate-600/50">
                                             Most Divergent Scores
                                        </h4>
                                        <div className="space-y-2">
                                            {mostControversialFilms.map((film) => (
                                                <ControversialFilmItem key={film.filmId} film={film} />
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-3 text-center italic">
                                            Films where {member.name} had the largest score difference from the club average.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* Selected Films Section */}
                {selectedFilms.length > 0 ? (
                    <div className="mb-12 mt-8">
                        <FilmList
                            films={selectedFilms}
                            title={`Films Selected by ${member.name}`}
                        />
                    </div>
                ) : (
                    // Only show this if the stats section *also* wouldn't show the "Films Selected" card
                    (!currentUserStats || currentUserStats.totalSelections === 0) && (
                        <div className="text-center py-8 text-slate-400 italic">
                            {member.name} hasn't selected any films yet.
                        </div>
                    )
                )}

            </div>
        </div>
    );
};

export default ProfilePage;