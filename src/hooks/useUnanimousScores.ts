import { useState, useEffect, useMemo } from 'react';
import { Film } from '../types/film';
import { TeamMember } from '../types/team';

export interface UnanimousScoreEntry {
    score: number;
    film: Film;
    watchDate: Date | null;
}

export interface UnanimousScoresData {
    score: number;
    films: UnanimousScoreEntry[];
    /** The "namesake" film - the first one watched with this unanimous score */
    namesakeFilm: Film;
}

export interface UseUnanimousScoresReturn {
    unanimousScores: UnanimousScoresData[];
    totalUnanimousCount: number;
    isLoading: boolean;
}

const parseWatchDate = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
};

export const useUnanimousScores = (
    films: Film[],
    teamMembers: TeamMember[]
): UseUnanimousScoresReturn => {
    const [isLoading, setIsLoading] = useState(true);

    const unanimousScores = useMemo(() => {
        if (!films.length || !teamMembers.length) {
            return [];
        }

        // Get active members (those with a queue position)
        const activeMembers = teamMembers.filter(m => typeof m.queue === 'number' && m.queue > 0);
        const activeMemberNames = new Set(activeMembers.map(m => m.name.toLowerCase()));

        if (activeMemberNames.size < 2) {
            return []; // Need at least 2 members for a unanimous score to be meaningful
        }

        // Find films where all active members gave the same score
        const unanimousFilms: UnanimousScoreEntry[] = [];

        films.forEach(film => {
            const movieClubInfo = film.movieClubInfo;
            if (!movieClubInfo?.clubRatings || movieClubInfo.clubRatings.length === 0) return;

            // Filter to only ratings from active members with valid scores
            const activeMemberRatings = movieClubInfo.clubRatings.filter(rating => 
                activeMemberNames.has(rating.user.toLowerCase()) && 
                rating.score !== null && 
                typeof rating.score === 'number' && 
                !isNaN(rating.score)
            );

            // Check if all active members have rated this film
            if (activeMemberRatings.length !== activeMemberNames.size) return;

            // Check if all scores are identical
            const scores = activeMemberRatings.map(r => r.score as number);
            const firstScore = scores[0];
            const allSame = scores.every(s => s === firstScore);

            if (allSame) {
                unanimousFilms.push({
                    score: firstScore,
                    film,
                    watchDate: parseWatchDate(movieClubInfo.watchDate)
                });
            }
        });

        // Group by score
        const scoreGroups = new Map<number, UnanimousScoreEntry[]>();

        unanimousFilms.forEach(entry => {
            const existing = scoreGroups.get(entry.score) || [];
            existing.push(entry);
            scoreGroups.set(entry.score, existing);
        });

        // Sort each group by watch date (earliest first) to determine the "namesake"
        const result: UnanimousScoresData[] = [];

        scoreGroups.forEach((entries, score) => {
            // Sort by watch date ascending (earliest first)
            const sortedEntries = [...entries].sort((a, b) => {
                if (!a.watchDate && !b.watchDate) return 0;
                if (!a.watchDate) return 1;
                if (!b.watchDate) return -1;
                return a.watchDate.getTime() - b.watchDate.getTime();
            });

            result.push({
                score,
                films: sortedEntries,
                namesakeFilm: sortedEntries[0].film
            });
        });

        // Sort result by score descending (highest scores first)
        result.sort((a, b) => b.score - a.score);

        return result;
    }, [films, teamMembers]);

    useEffect(() => {
        setIsLoading(false);
    }, [unanimousScores]);

    const totalUnanimousCount = useMemo(() => {
        return unanimousScores.reduce((sum, group) => sum + group.films.length, 0);
    }, [unanimousScores]);

    return {
        unanimousScores,
        totalUnanimousCount,
        isLoading
    };
};