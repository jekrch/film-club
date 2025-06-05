import { Film, ClubRating } from '../types/film';
import { calculateClubAverage } from './ratingUtils'; // Assuming this exists and is correct

// --- Interfaces ---
// Combined/Comprehensive stats structure
export interface ComprehensiveMemberStats {
    totalSelections: number;
    totalRuntime: number | null;
    avgRuntime: number | null;
    topGenres: { genre: string; count: number }[]; // From ProfilePage
    avgSelectedScore: number | null;
    avgGivenScore: number | null;
    avgDivergence: number | null; // Signed divergence (From ProfilePage)
    avgAbsoluteDivergence: number | null; // Absolute divergence (For ranking in ProfilePage)
    languageCount: number; // From ProfilePage (Unique languages of selections)
    countryCount: number; // From ProfilePage (Unique countries of selections)
    selectionCountryCount: number; // From AlmanacPage (Seems identical to countryCount, using one)
    avgSelectionYear: number | null; // From AlmanacPage
    countryDiversityPercentage: number | null;
}

// Interfaces needed by ProfilePage specifically
export interface UserProfileStats extends Omit<ComprehensiveMemberStats, 'selectionCountryCount' | 'avgSelectionYear'> {
    // ProfilePage primarily uses these fields from ComprehensiveMemberStats
}

export interface UserRankings {
    totalRuntimeRank: string | null;
    avgRuntimeRank: string | null;
    avgSelectedScoreRank: string | null;
    avgGivenScoreRank: string | null;
    avgDivergenceRank: string | null; // Rank based on absolute divergence magnitude
    countryDiversityRank: string | null;
}

export interface MemberStatsCalculationData {
    memberName: string;
    stats: UserProfileStats; // ProfilePage uses this specific subset + rankValues
    rankValues: {
        totalRuntime: number | null;
        avgRuntime: number | null;
        avgSelectedScore: number | null;
        avgGivenScore: number | null;
        avgDivergence: number | null; // Signed average divergence
        avgAbsoluteDivergence: number | null; // Absolute average divergence for ranking
        countryDiversityPercentage: number | null;
    };
}

export interface ControversialFilm {
    filmId: string;
    title: string;
    userScore: number;
    othersAvgScore: number | null;
    divergence: number; // Signed difference (userScore - othersAvgScore)
    posterUrl?: string;
    watchDate?: string;
    memberName?: string;
}

// Interfaces needed by AlmanacPage specifically
// Note: AlmanacPage's UserStats is now covered by ComprehensiveMemberStats
// We keep the specific highlight type needed by AlmanacPage
export type MemberStatHighlight = 'high' | 'low' | null;

export const parseRuntime = (runtime: string | undefined | null): number | null => {
    if (!runtime || typeof runtime !== 'string') return null;
    const minutes = parseInt(runtime.replace(/[^0-9]/g, ''), 10);
    return !isNaN(minutes) ? minutes : null;
};

export const formatTotalRuntime = (totalMinutes: number | null): string | null => {
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

export const formatAverage = (avg: number | null | undefined, digits = 1): string | null => {
    if (avg === null || avg === undefined || isNaN(avg)) return null;
    // Return as string, AlmanacPage handles 'N/A' separately if needed in its rendering
    return avg.toFixed(digits);
};

export const countValidRatings = (clubRatings: ClubRating[] | undefined): number => {
    if (!clubRatings || !Array.isArray(clubRatings)) return 0;
    return clubRatings.filter(rating => rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score as number)).length;
};

export const getRankString = (
    value: number | null,
    allValues: (number | null)[],
    higherIsBetter: boolean = true
): string | null => {
    if (value === null || isNaN(value)) return null;

    const validValues = allValues
        .filter((v): v is number => v !== null && !isNaN(v))
        .sort((a, b) => (higherIsBetter ? b - a : a - b));

    if (validValues.length < 2) return null;

    // Find the rank. Use findIndex for exact match.
    // For divergence (lower magnitude is better), the sorting is already ascending.
    const rank = validValues.findIndex(v => v === value) + 1;

     if (rank === 0) {
       // Handle potential floating point inaccuracies if needed, maybe check within a small epsilon
       const epsilon = 1e-9;
       const approxRank = validValues.findIndex(v => Math.abs(v - value) < epsilon) + 1;
       if (approxRank === 0) return null;
       return `${approxRank}/${validValues.length}`;
     }

    return `${rank}/${validValues.length}`;
};

// --- Core Stat Calculation Logic ---

export const calculateMemberStats = (memberName: string, films: Film[]): ComprehensiveMemberStats => {
    const normalizedUserName = memberName.toLowerCase();
    const userSelections = films.filter(film => film.movieClubInfo?.selector === memberName);
    const totalSelections = userSelections.length;

    // Runtime calculations
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

    // Genre calculations (ProfilePage)
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

    // Avg Selection Score (Club Average for selected films with >= 2 ratings)
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

    // Avg Given Score & Divergence calculations
    let totalGivenScore = 0;
    let givenScoreCount = 0;
    let totalSignedDivergence = 0; // Sum of (userScore - othersAvg)
    let totalAbsoluteDivergence = 0; // Sum of |userScore - othersAvg|
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
                const signedDivergence = userScore - othersAvg; // Calculate signed difference
                const absoluteDivergence = Math.abs(signedDivergence); // Calculate absolute difference

                totalSignedDivergence += signedDivergence;
                totalAbsoluteDivergence += absoluteDivergence;
                divergenceCount++;
            }
        }
    });

    const avgGivenScore = givenScoreCount > 0 ? totalGivenScore / givenScoreCount : null;
    const avgDivergence = divergenceCount > 0 ? totalSignedDivergence / divergenceCount : null; // Signed avg
    const avgAbsoluteDivergence = divergenceCount > 0 ? totalAbsoluteDivergence / divergenceCount : null; // Absolute avg

    // Language count (ProfilePage)
    const languages = new Set<string>();
    userSelections.forEach(film => {
        if (film?.language?.trim() && film.language !== "N/A") languages.add(film.language.split(',')[0].trim());
    });
    const languageCount = languages.size;

    // Country count (ProfilePage & AlmanacPage - assuming same definition)
    const countries = new Set<string>();
    userSelections.forEach(film => {
        if (film?.country?.trim() && film.country !== "N/A") countries.add(film.country.split(',')[0].trim());
    });
    const countryCount = countries.size;

    const countryDiversityPercentage = totalSelections > 0 
        ? (countryCount / totalSelections) * 100 
        : null;

    // Avg Selection Year (AlmanacPage)
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

    // Construct the comprehensive stats object
    const stats: ComprehensiveMemberStats = {
        totalSelections,
        totalRuntime: totalRuntime > 0 ? totalRuntime : null,
        avgRuntime,
        topGenres: sortedGenres,
        avgSelectedScore,
        avgGivenScore,
        avgDivergence, // Signed average
        avgAbsoluteDivergence, // Absolute average
        languageCount,
        countryCount,
        selectionCountryCount: countryCount, // Use the same value for Almanac's field
        avgSelectionYear,
        countryDiversityPercentage: countryDiversityPercentage,
    };

    return stats;
};