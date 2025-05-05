import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
// --- Import Heroicons ---
import {
    FilmIcon,
    ClockIcon,
    PencilSquareIcon,
    LanguageIcon,
    MapPinIcon,
    TagIcon,
    HashtagIcon,
    TrophyIcon,
    ArrowsRightLeftIcon,
    ChevronLeftIcon,
    ChevronUpIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';

import CircularImage from '../components/common/CircularImage';
import FilmList from '../components/films/FilmList';
import { teamMembers as allTeamMembers } from '../types/team';
import { Film, getClubRating, filmData, ClubRating } from '../types/film';
import { calculateClubAverage } from '../utils/ratingUtils';

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

interface UserProfileStats {
    totalSelections: number;
    totalRuntime: number | null;
    avgRuntime: number | null;
    topGenres: { genre: string; count: number }[];
    avgSelectedScore: number | null;
    avgGivenScore: number | null;
    avgDivergence: number | null;
    languageCount: number;
    countryCount: number;
}

interface UserRankings {
    totalRuntimeRank: string | null;
    avgRuntimeRank: string | null;
    avgSelectedScoreRank: string | null;
    avgGivenScoreRank: string | null;
    avgDivergenceRank: string | null;
}

interface MemberStatsCalculationData {
    memberName: string;
    stats: UserProfileStats;
    rankValues: {
        totalRuntime: number | null;
        avgRuntime: number | null;
        avgSelectedScore: number | null;
        avgGivenScore: number | null;
        avgDivergence: number | null;
    };
}

interface ControversialFilm {
    filmId: string;
    title: string;
    userScore: number;
    othersAvgScore: number | null;
    divergence: number;
    posterUrl?: string;
    watchDate?: string;
}


// --- Helper Functions ---

const parseRuntime = (runtime: string | undefined | null): number | null => {
    if (!runtime || typeof runtime !== 'string') return null;
    const minutes = parseInt(runtime.replace(/[^0-9]/g, ''), 10);
    return !isNaN(minutes) ? minutes : null;
};

const formatTotalRuntime = (totalMinutes: number | null): string | null => {
    if (totalMinutes === null || isNaN(totalMinutes) || totalMinutes <= 0) return null;
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
    return result || null;
};

const formatAverage = (avg: number | null | undefined, digits = 1): string | null => {
    if (avg === null || avg === undefined || isNaN(avg)) return null;
    return avg.toFixed(digits);
};

const countValidRatings = (clubRatings: ClubRating[] | undefined): number => {
    if (!clubRatings || !Array.isArray(clubRatings)) return 0;
    return clubRatings.filter(rating => rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score as number)).length;
};

const getRankString = (
    value: number | null,
    allValues: (number | null)[],
    higherIsBetter: boolean = true
): string | null => {
    if (value === null || isNaN(value)) return null;

    const validValues = allValues
        .filter((v): v is number => v !== null && !isNaN(v))
        .sort((a, b) => (higherIsBetter ? b - a : a - b));

    if (validValues.length < 2) return null;

    const rank = validValues.findIndex(v => v === value) + 1;

    if (rank === 0) return null;

    return `${rank}/${validValues.length}`;
};


// --- Components ---

const InterviewItem: React.FC<InterviewItemProps> = ({ question, answer }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const needsExpander = answer.length > 200;

    return (
        <div className="py-5">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">{question}</h4>
            <div className={`prose prose-sm prose-invert max-w-none text-slate-300 ${!isExpanded && needsExpander ? 'line-clamp-4' : ''}`}>
                <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
            {needsExpander && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-2 inline-flex items-center"
                >
                    {isExpanded ? 'Read Less' : 'Read More'}
                    {isExpanded ? <ChevronUpIcon className="h-4 w-4 ml-1" /> : <ChevronDownIcon className="h-4 w-4 ml-1" />}
                </button>
            )}
        </div>
    );
};

interface ProfileStatCardProps {
    id: string;
    label: string;
    value: string | number | { genre: string; count: number }[];
    rank?: string | null;
    description?: string;
    valueClassName?: string;
    icon?: React.ElementType;
}

const ProfileStatCard: React.FC<ProfileStatCardProps> = ({
    id,
    label,
    value,
    rank,
    description,
    valueClassName = "text-slate-100",
    icon: IconComponent
}) => {
    if (value === null || value === undefined || value === '' || value === 'N/A' || (id === 'topGenres' && (!Array.isArray(value) || value.length === 0))) {
        return null;
    }

    let rankDisplay = null;
    if (rank && typeof rank === 'string' && rank.includes('/') && id !== 'topGenres') {
        const [rankNum, totalNum] = rank.split('/');
        rankDisplay = (
            <span className="text-sm font-normal text-slate-400 ml-2 whitespace-nowrap ">
                <HashtagIcon className="inline h-3 w-3 mr-0.5 relative -top-px" />{rankNum}
                <span className="text-xs"> of {totalNum}</span>
            </span>
        );
    }

    return (
        <div className="bg-slate-700/30 border border-slate-700 rounded-lg p-4 flex flex-col justify-between shadow-md hover:shadow-lg hover:border-slate-600 transition-all duration-200 min-h-[120px]">
            <div>
                <div className="flex items-center text-sm font-medium text-blue-300/80 mb-2">
                    {IconComponent && <IconComponent className="h-5 w-5 mr-2 flex-shrink-0" aria-hidden="true" />}
                    <h4 className="truncate" title={label}>{label}</h4>
                </div>

                {id === 'topGenres' && Array.isArray(value) ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {value.map(({ genre, count }) => (
                             <span key={genre} className="px-3 py-1 bg-slate-700 text-blue-300 text-xs font-medium rounded-full shadow-sm whitespace-nowrap">
                                 {genre} <span className="text-slate-400 text-[11px]">({count})</span>
                             </span>
                         ))}
                    </div>
                ) : (
                    <p className={`text-2xl xl:text-3xl font-semibold ${valueClassName} break-words`}>
                        {value as any}
                        {rankDisplay}
                    </p>
                )}
            </div>
            {description && (
                <p className="text-xs text-slate-400/80 mt-2">
                    {description}
                </p>
            )}
        </div>
    );
};

interface ProfileStatsSectionProps {
    stats: UserProfileStats | null;
    rankings: UserRankings | null;
}

interface StatCardConfig {
    id: keyof UserProfileStats;
    label: string;
    getValue: (stats: UserProfileStats) => number | string | null | { genre: string; count: number }[];
    formatValue?: (value: any) => string | number | null;
    getRank?: (rankings: UserRankings) => string | null;
    description?: string;
    icon: React.ElementType;
    valueClassName?: string | ((rank: string | null) => string);
}

const ProfileStatsSection: React.FC<ProfileStatsSectionProps> = ({ stats, rankings }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_VISIBLE_CARDS_COLLAPSED = 8;

    const statCardDefinitions: StatCardConfig[] = useMemo(() => [
        { id: 'totalSelections', label: "Films Selected", getValue: (s) => s.totalSelections, formatValue: (v) => (v !== null && v > 0 ? v : null), icon: FilmIcon },
        { id: 'totalRuntime', label: "Total Runtime (Selected)", getValue: (s) => s.totalRuntime, formatValue: formatTotalRuntime, getRank: (r) => r.totalRuntimeRank, description: "Total duration of selected films.", icon: ClockIcon },
        { id: 'avgRuntime', label: "Avg. Runtime (Selected)", getValue: (s) => s.avgRuntime, formatValue: (v) => { const f = formatAverage(v, 0); return f ? `${f} min` : null; }, getRank: (r) => r.avgRuntimeRank, description: "Average duration per selected film.", icon: ClockIcon },
        { id: 'topGenres', label: "Top Genres (Selected)", getValue: (s) => s.topGenres, description: "Most frequently selected genres (Top 3).", icon: TagIcon },
        { id: 'avgSelectedScore', label: "Avg. Club Score (Selected)", getValue: (s) => s.avgSelectedScore, formatValue: (v) => formatAverage(v, 2), getRank: (r) => r.avgSelectedScoreRank, description: "Avg. score on selected films (min. 2 ratings).", icon: TrophyIcon },
        { id: 'avgGivenScore', label: "Avg. Score Given", getValue: (s) => s.avgGivenScore, formatValue: (v) => formatAverage(v, 2), getRank: (r) => r.avgGivenScoreRank, description: "Avg. score given to any club film.", icon: PencilSquareIcon },
        { id: 'avgDivergence', label: "Avg. Score Divergence", getValue: (s) => s.avgDivergence, formatValue: (v) => formatAverage(v, 2), getRank: (r) => r.avgDivergenceRank, description: "Avg. difference from others' scores.", icon: ArrowsRightLeftIcon },
        { id: 'languageCount', label: "Unique Languages (Selected)", getValue: (s) => s.languageCount, formatValue: (v) => (v !== null && v > 0 ? v : null), description: "Primary languages of selected films.", icon: LanguageIcon },
        { id: 'countryCount', label: "Unique Countries (Selected)", getValue: (s) => s.countryCount, formatValue: (v) => (v !== null && v > 0 ? v : null), description: "Primary countries of selected films.", icon: MapPinIcon },
    ], []);

    const visibleStatCards = useMemo(() => {
        if (!stats) return [];
        return statCardDefinitions
            .map(config => {
                const rawValue = config.getValue(stats);
                let displayValue: string | number | null | { genre: string; count: number }[] = null;

                if (config.id === 'topGenres') {
                    displayValue = (Array.isArray(rawValue) && rawValue.length > 0) ? rawValue : null;
                } else if (config.formatValue) {
                    displayValue = config.formatValue(rawValue);
                } else {
                    displayValue = (rawValue !== null && rawValue !== 0) ? rawValue as (string | number) : null;
                }

                const rank = (config.getRank && rankings) ? config.getRank(rankings) : null;
                let className = "text-slate-100";
                if (config.id !== 'topGenres') {
                    if (typeof config.valueClassName === 'function') className = config.valueClassName(rank);
                    else if (typeof config.valueClassName === 'string') className = config.valueClassName;
                }

                return { ...config, displayValue, displayRank: rank, displayClassName: className };
            })
            .filter(card => card.displayValue !== null);
    }, [stats, rankings, statCardDefinitions]);

    if (!stats || visibleStatCards.length === 0) {
        return null; // Don't render the section if no stats apply
    }

    const needsExpansion = visibleStatCards.length > MAX_VISIBLE_CARDS_COLLAPSED;
    const collapsedMaxHeight = 'max-h-72';

    return (
        // This component now renders *only* the stats grid content
        // The outer container/grid logic is handled in ProfilePage
        <div className="bg-slate-800 rounded-lg p-6 md:p-8 border border-slate-700 shadow-xl shadow-slate-950/30 h-full"> {/* Added h-full for grid alignment */}
            <h3 className="text-2xl font-bold text-slate-100 mb-5 border-b border-slate-700 pb-3">
                Member Stats
            </h3>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isExpanded && needsExpansion ? collapsedMaxHeight : 'max-h-[1000px]'}`}>
                 <div className={`pr-2 -mr-2 ${!isExpanded && needsExpansion ? 'overflow-y-auto ' + collapsedMaxHeight : ''}`}>
                    {/* Grid for stat cards (adjust columns as needed, maybe fewer if sharing space) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"> {/* Example: 3 cols on XL */}
                         {visibleStatCards.map((card) => (
                            <ProfileStatCard
                                key={card.id}
                                id={card.id}
                                label={card.label}
                                value={card.displayValue!}
                                rank={card.displayRank}
                                description={card.description}
                                icon={card.icon}
                                valueClassName={card.displayClassName}
                            />
                         ))}
                    </div>
                </div>
            </div>
            {needsExpansion && (
                 <div className="mt-4 text-center border-t border-slate-700 pt-4">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center"
                    >
                        {isExpanded ? (
                            <> Show Less Stats <ChevronUpIcon className="h-4 w-4 ml-1" /> </>
                        ) : (
                            <> Show All Stats ({visibleStatCards.length} total) <ChevronDownIcon className="h-4 w-4 ml-1" /> </>
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
    const handleNavigate = () => navigate(`/films/${film.filmId}`);

    return (
        <div
            className="flex items-center space-x-4 p-3 bg-slate-700/30 hover:bg-slate-700/60 rounded-md transition-colors duration-150 cursor-pointer"
            onClick={handleNavigate}
            title={`View ${film.title}`}
        >
            {film.posterUrl && film.posterUrl !== 'N/A' ? (
                <img src={film.posterUrl} alt={film.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
            ) : (
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
    const [mostControversialFilms, setMostControversialFilms] = useState<ControversialFilm[]>([]);
    const [currentUserStats, setCurrentUserStats] = useState<UserProfileStats | null>(null);
    const [rankings, setRankings] = useState<UserRankings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isInterviewExpanded, setIsInterviewExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Memoize the calculation function for all member stats
    const calculateAllMemberStats = useMemo(() => {
        return (films: Film[], activeMembers: TeamMember[]): MemberStatsCalculationData[] => {
            return activeMembers.map(m => {
                // ... (calculations remain the same as previous correct version)
                const memberName = m.name;
                const normalizedUserName = memberName.toLowerCase();

                const userSelections = films.filter(film => film.movieClubInfo?.selector === memberName);
                const totalSelections = userSelections.length;

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

                let totalSelectedScore = 0;
                let selectedScoreCount = 0;
                userSelections.forEach(film => {
                    const validRatingCount = countValidRatings(film.movieClubInfo?.clubRatings);
                    if (validRatingCount >= 2) {
                        const avg = calculateClubAverage(film.movieClubInfo?.clubRatings);
                        if (avg !== null && !isNaN(avg)) {
                            totalSelectedScore += avg;
                            selectedScoreCount++;
                        }
                    }
                });
                const avgSelectedScore = selectedScoreCount > 0 ? totalSelectedScore / selectedScoreCount : null;

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

                        if (userScore !== null) {
                            totalGivenScore += userScore;
                            givenScoreCount++;
                        }

                        const otherRatings = ratings.filter(r =>
                            r.user.toLowerCase() !== normalizedUserName &&
                            r.score !== null && typeof r.score === 'number' && !isNaN(r.score)
                        );

                        if (userScore !== null && otherRatings.length > 0) {
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

                const languages = new Set<string>();
                userSelections.forEach(film => {
                    if (film?.language?.trim() && film.language !== "N/A") languages.add(film.language.split(',')[0].trim());
                });
                const languageCount = languages.size;

                const countries = new Set<string>();
                userSelections.forEach(film => {
                    if (film?.country?.trim() && film.country !== "N/A") countries.add(film.country.split(',')[0].trim());
                });
                const countryCount = countries.size;

                const stats: UserProfileStats = {
                    totalSelections,
                    totalRuntime: totalRuntime > 0 ? totalRuntime : null,
                    avgRuntime,
                    topGenres: sortedGenres,
                    avgSelectedScore,
                    avgGivenScore,
                    avgDivergence,
                    languageCount,
                    countryCount,
                };

                const rankValues = {
                    totalRuntime: stats.totalRuntime,
                    avgRuntime: stats.avgRuntime,
                    avgSelectedScore: stats.avgSelectedScore,
                    avgGivenScore: stats.avgGivenScore,
                    avgDivergence: stats.avgDivergence,
                };

                return { memberName, stats, rankValues };
            });
        };
    }, []);

    useEffect(() => {
        // ... (fetch/calculation logic remains the same as previous correct version)
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
                const ratingA = getClubRating(a, normalizedUserName)?.score ?? 0;
                const ratingB = getClubRating(b, normalizedUserName)?.score ?? 0;
                if (ratingB !== ratingA) return ratingB - ratingA;
                const dateA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : 0;
                const dateB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : 0;
                if (dateB !== dateA) return dateB - dateA;
                return a.title.localeCompare(b.title);
            })
            .slice(0, 6);
        setTopRatedFilms(filmsRatedByMember);

        const controversialFilmsData: ControversialFilm[] = [];
        filmData.forEach(film => {
            const validRatings = film.movieClubInfo?.clubRatings?.filter(r => r.score !== null && typeof r.score === 'number' && !isNaN(r.score));
            if (!validRatings || validRatings.length < 2) return;

            let maxDivergence = -1;
            let mostDivergentUserLower = '';
            let filmControversyDetails: { [userNameLower: string]: { userScore: number; othersAvg: number | null; divergence: number } } = {};

            validRatings.forEach(rating => {
                const currentUserScore = Number(rating.score);
                const currentUserNameLower = rating.user.toLowerCase();
                const otherRatingsForThisUser = validRatings.filter(r => r.user.toLowerCase() !== currentUserNameLower);

                if (otherRatingsForThisUser.length > 0) {
                    let othersTotal = 0;
                    otherRatingsForThisUser.forEach(r => othersTotal += Number(r.score));
                    const othersAvg = othersTotal / otherRatingsForThisUser.length;
                    const divergence = Math.abs(currentUserScore - othersAvg);
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: othersAvg, divergence: divergence };
                    if (divergence > maxDivergence) {
                        maxDivergence = divergence;
                        mostDivergentUserLower = currentUserNameLower;
                    }
                } else {
                    filmControversyDetails[currentUserNameLower] = { userScore: currentUserScore, othersAvg: null, divergence: 0 };
                }
            });

            if (mostDivergentUserLower === normalizedUserName && maxDivergence > 0) {
                 const details = filmControversyDetails[normalizedUserName];
                 if (details) controversialFilmsData.push({ filmId: film.imdbID, title: film.title, userScore: details.userScore, othersAvgScore: details.othersAvg, divergence: details.divergence, posterUrl: film.poster, watchDate: film.movieClubInfo?.watchDate as any });
            }
        });
        controversialFilmsData.sort((a, b) => b.divergence - a.divergence);
        setMostControversialFilms(controversialFilmsData.slice(0, 4));

        const activeMembers = allTeamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        if (activeMembers.length > 0) {
            const allStatsData = calculateAllMemberStats(filmData, activeMembers);
            const currentUserData = allStatsData.find(data => data.memberName === decodedMemberName);
            if (currentUserData) {
                setCurrentUserStats(currentUserData.stats);
                const allTotals = allStatsData.map(d => d.rankValues.totalRuntime);
                const allAvgs = allStatsData.map(d => d.rankValues.avgRuntime);
                const allSelScores = allStatsData.map(d => d.rankValues.avgSelectedScore);
                const allGivenScores = allStatsData.map(d => d.rankValues.avgGivenScore);
                const allDivs = allStatsData.map(d => d.rankValues.avgDivergence);
                setRankings({
                    totalRuntimeRank: getRankString(currentUserData.rankValues.totalRuntime, allTotals, true),
                    avgRuntimeRank: getRankString(currentUserData.rankValues.avgRuntime, allAvgs, true),
                    avgSelectedScoreRank: getRankString(currentUserData.rankValues.avgSelectedScore, allSelScores, true),
                    avgGivenScoreRank: getRankString(currentUserData.rankValues.avgGivenScore, allGivenScores, true),
                    avgDivergenceRank: getRankString(currentUserData.rankValues.avgDivergence, allDivs, true),
                });
            } else {
                const inactiveMemberData = calculateAllMemberStats(filmData, [foundMember]);
                if (inactiveMemberData.length > 0) setCurrentUserStats(inactiveMemberData[0].stats);
                setRankings({ totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null });
            }
        } else {
            const singleMemberData = calculateAllMemberStats(filmData, [foundMember]);
            if (singleMemberData.length > 0) setCurrentUserStats(singleMemberData[0].stats);
            setRankings({ totalRuntimeRank: null, avgRuntimeRank: null, avgSelectedScoreRank: null, avgGivenScoreRank: null, avgDivergenceRank: null });
        }

        setLoading(false);

    }, [memberName, calculateAllMemberStats]);

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

    const MAX_INTERVIEW_ITEMS_BEFORE_SCROLL = 2;
    const needsInterviewExpansion = member.interview && member.interview.length > MAX_INTERVIEW_ITEMS_BEFORE_SCROLL;
    const collapsedInterviewMaxHeight = 'max-h-80';
    const hasEnoughControversialFilms = mostControversialFilms.length >= 1;
    const hasStats = currentUserStats && Object.values(currentUserStats).some(val => val !== null && val !== 0 && (!Array.isArray(val) || val.length > 0));

    return (
        <div className="bg-slate-900 text-slate-300 min-h-screen py-12 pt-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Back button */}
                <button onClick={() => navigate(-1)} className="mb-8 inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors group">
                    <ChevronLeftIcon className="h-5 w-5 mr-1 transition-transform group-hover:-translate-x-1" />
                    Back
                </button>

                {/* Profile Header Section */}
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg overflow-hidden mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                    <div className="p-6 md:p-10 flex flex-col sm:flex-row items-center sm:items-start sm:space-x-16">
                        <CircularImage src={member.image} alt={member.name} size="w-52 h-52 sm:w-42 sm:h-42" className="flex-shrink-0 border-2 border-slate-600 mb-6 sm:mb-0"/>
                        <div className="text-center sm:text-left sm:ml-10 flex-grow min-w-0">
                            <h1 className="text-3xl sm:text-4xl font- text-slate-100 mb-2">{member.name}</h1>
                            <p className="text-lg text-blue-400/90 mb-4">{member.title}</p>
                            <div className="text-slate-300 leading-relaxed max-w-xl mx-auto sm:mx-0 prose prose-sm prose-invert max-w-none">
                                <ReactMarkdown>{member.bio}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interview Section */}
                {member.interview && member.interview.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-6 md:p-10 mb-8 border border-slate-700 shadow-xl shadow-slate-950/30">
                        <h3 className="text-2xl font-bold text-slate-100 mb-4 border-b border-slate-700 pb-3"> Interview </h3>
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${!isInterviewExpanded && needsInterviewExpansion ? collapsedInterviewMaxHeight : 'max-h-[1500px]'}`}>
                            <div className={`pr-2 -mr-2 ${!isInterviewExpanded && needsInterviewExpansion ? 'overflow-y-auto ' + collapsedInterviewMaxHeight : ''}`}>
                                <div className="divide-y divide-slate-700">
                                    {member.interview.map((item, index) => <InterviewItem key={index} question={item.question} answer={item.answer} />)}
                                </div>
                            </div>
                        </div>
                        {needsInterviewExpansion && (
                            <div className="mt-4 text-center border-t border-slate-700 pt-4">
                                <button onClick={() => setIsInterviewExpanded(!isInterviewExpanded)} className="text-blue-400 hover:text-blue-300 text-sm font-medium inline-flex items-center">
                                    {isInterviewExpanded ? (<> Show Less <ChevronUpIcon className="h-4 w-4 ml-1" /> </>) : (<> Show Full Interview <ChevronDownIcon className="h-4 w-4 ml-1" /> </>)}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* --- Combined Stats and Divergence Section (Grid on Large Screens) --- */}
                {/* Only render this container if there are stats OR controversial films to show */}
                {(hasStats || hasEnoughControversialFilms) && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                        {/* Member Stats Column */}
                        {/* Check hasStats here to ensure the column exists even if divergence doesn't */}
                        <div className="lg:col-span-2">
                           {hasStats ? (
                               <ProfileStatsSection stats={currentUserStats} rankings={rankings} />
                           ) : (
                               <div className="hidden lg:block"></div> // Placeholder on large screens if no stats but divergence exists
                           )}
                        </div>

                        {/* Most Divergent Scores Column (Conditionally Rendered) */}
                        {hasEnoughControversialFilms && (
                            <div className="lg:col-span-1">
                                <div className="p-4 bg-slate-700/50 border border-slate-700 rounded-lg shadow-md h-full"> {/* Add h-full */}
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
                         {/* Ensure the grid structure is maintained even if only stats exist */}
                         {!hasEnoughControversialFilms && hasStats && (
                            <div className="lg:col-span-1 hidden lg:block"></div> // Occupy space on large screens
                         )}
                    </div>
                )}


                 {/* --- Top Rated Films Section (Full Width) --- */}
                 {topRatedFilms.length > 0 && (
                    <div className="mb-12 mt-8"> {/* Use mt-8 only if the Stats/Div section above it rendered */}
                        <FilmList
                            films={topRatedFilms}
                            title={`Top ${topRatedFilms.length} Rated Film${topRatedFilms.length !== 1 ? 's' : ''} by ${member.name}`}
                        />
                    </div>
                 )}

                {/* --- Selected Films Section (Full Width) --- */}
                {selectedFilms.length > 0 ? (
                    <div className="mb-12 mt-8"> {/* Use mt-8 */}
                        <FilmList
                            films={selectedFilms}
                            title={`Films Selected by ${member.name}`}
                        />
                    </div>
                ) : (
                    // Show only if no selections AND no stats card showing selections
                    (!currentUserStats || currentUserStats.totalSelections === 0) && (
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