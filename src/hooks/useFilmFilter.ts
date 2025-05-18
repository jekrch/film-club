import { useState, useEffect, useMemo, useCallback } from 'react';
import { Film } from '../types/film';
import { calculateClubAverage } from '../utils/ratingUtils';
import { capitalizeUserName, teamMembers } from '../types/team'; // Assuming teamMembers are needed for selector names or member sort options

// Helper function to check if a film has any club ratings
const hasAnyClubRating = (film: Film): boolean => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) return false;
    return ratings.some(rating => rating.score !== null && typeof rating.score === 'number');
};

// Helper function to check if a film has at least N valid club ratings
const hasMinClubRatings = (film: Film, minCount: number): boolean => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings)) return false;
    const validRatings = ratings.filter(rating => rating.score !== null && typeof rating.score === 'number');
    return validRatings.length >= minCount;
};

// Helper to get a specific member's rating
const getMemberRating = (film: Film, memberName: string): number | null => {
    if (!film.movieClubInfo?.clubRatings) return null;
    const memberRating = film.movieClubInfo.clubRatings.find(
        rating => rating.user.toLowerCase() === memberName.toLowerCase()
    );
    const score = memberRating?.score;
    return typeof score === 'number' ? score : null;
};

// Helper to calculate the score difference for a film
const calculateScoreDifference = (film: Film): number | null => {
    const ratings = film.movieClubInfo?.clubRatings;
    if (!ratings || !Array.isArray(ratings)) return null;

    const validScores = ratings
        .map(r => r.score)
        .filter(score => typeof score === 'number') as number[];

    if (validScores.length < 2) return null;

    const maxScore = Math.max(...validScores);
    const minScore = Math.min(...validScores);
    return maxScore - minScore;
};

// Helper to parse the genre string into an array (can be moved to filmUtils if not already there)
const parseGenres = (genreString?: string): string[] => {
    if (!genreString || typeof genreString !== 'string') return [];
    return genreString.split(',').map(g => g.trim()).filter(g => g);
};

// Define Member Names for sorting
const clubMemberNames = teamMembers.filter(t => t.queue).map(u => u.name);

export type BaseSortOption = 'title' | 'year' | 'clubRating' | 'watchDate' | 'controversial';
export type MemberSortOption = string; // Typically a member's name
export type SortOption = BaseSortOption | MemberSortOption;

export const getSortOptionDisplayName = (option: SortOption): string => {
    switch (option) {
        case 'title': return 'Title';
        case 'year': return 'Year';
        case 'clubRating': return 'Club Rating';
        case 'watchDate': return 'Watch Date';
        case 'controversial': return 'Controversial';
        default:
            return capitalizeUserName(option); // Assumes any other string is a member name
    }
};

export interface UseFilmFilteringReturn {
    filteredFilms: Film[];
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    selectedGenre: string;
    setSelectedGenre: React.Dispatch<React.SetStateAction<string>>;
    allGenres: string[];
    selectedSelector: string;
    setSelectedSelector: React.Dispatch<React.SetStateAction<string>>;
    allSelectors: string[];
    sortBy: SortOption;
    sortDirection: 'asc' | 'desc';
    handleSortChange: (option: SortOption) => void;
    resultsText: string;
}

export const useFilmFiltering = (
    initialFilms: Film[],
    defaultSortBy: SortOption = 'watchDate',
    defaultSortDirection: 'asc' | 'desc' = 'desc'
): UseFilmFilteringReturn => {
    const [films, setFilms] = useState<Film[]>(initialFilms);
    const [filteredFilms, setFilteredFilms] = useState<Film[]>(initialFilms);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string>('');
    const [selectedSelector, setSelectedSelector] = useState<string>('');
    const [sortBy, setSortBy] = useState<SortOption>(defaultSortBy);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection);

    useEffect(() => {
        setFilms(initialFilms);
    }, [initialFilms]);

    const allGenres = useMemo(() => {
        const genreSet = new Set<string>();
        films.forEach(film => {
            if (film?.genre && typeof film.genre === 'string') {
                parseGenres(film.genre).forEach(genre => genreSet.add(genre));
            }
        });
        return Array.from(genreSet).sort();
    }, [films]);

    const allSelectors = useMemo(() => {
        const selectorSet = new Set<string>();
        films.forEach(film => {
            if (film?.movieClubInfo?.selector?.trim()) {
                selectorSet.add(film.movieClubInfo.selector.trim());
            }
        });
        return Array.from(selectorSet).sort();
    }, [films]);

    useEffect(() => {
        let workingFiltered = [...films];

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            workingFiltered = workingFiltered.filter(film =>
                (film.title?.toLowerCase().includes(searchLower)) ||
                (film.director?.toLowerCase().includes(searchLower))
            );
        }

        if (selectedGenre) {
            workingFiltered = workingFiltered.filter(film =>
                parseGenres(film.genre).includes(selectedGenre)
            );
        }

        if (selectedSelector) {
            workingFiltered = workingFiltered.filter(film =>
                film.movieClubInfo?.selector === selectedSelector
            );
        }

        if (clubMemberNames.includes(sortBy as MemberSortOption)) {
            const memberName = sortBy as MemberSortOption;
            workingFiltered = workingFiltered.filter(film =>
                film.movieClubInfo?.clubRatings?.some(
                    rating => rating.user.toLowerCase() === memberName.toLowerCase() && typeof rating.score === 'number'
                )
            );
        } else if (sortBy === 'clubRating') {
            workingFiltered = workingFiltered.filter(hasAnyClubRating);
        } else if (sortBy === 'controversial') {
            workingFiltered = workingFiltered.filter(film => hasMinClubRatings(film, 2));
        }

        workingFiltered.sort((a, b) => {
            let comparison = 0;
            const handleNulls = (val: number | null | undefined): number =>
                (val === null || val === undefined || isNaN(val))
                    ? (sortDirection === 'asc' ? Infinity : -Infinity)
                    : val;

            if (clubMemberNames.includes(sortBy as MemberSortOption)) {
                const memberName = sortBy as MemberSortOption;
                comparison = handleNulls(getMemberRating(a, memberName)) - handleNulls(getMemberRating(b, memberName));
            } else {
                switch (sortBy) {
                    case 'title':
                        comparison = (a.title ?? '').localeCompare(b.title ?? '');
                        break;
                    case 'year':
                        comparison = handleNulls(parseInt(a.year, 10)) - handleNulls(parseInt(b.year, 10));
                        break;
                    case 'clubRating':
                        const avgA = calculateClubAverage(a.movieClubInfo?.clubRatings);
                        const avgB = calculateClubAverage(b.movieClubInfo?.clubRatings);
                        comparison = handleNulls(avgA) - handleNulls(avgB);
                        break;
                    case 'watchDate':
                        const timeA = a.movieClubInfo?.watchDate ? new Date(a.movieClubInfo.watchDate).getTime() : NaN;
                        const timeB = b.movieClubInfo?.watchDate ? new Date(b.movieClubInfo.watchDate).getTime() : NaN;
                        comparison = handleNulls(timeA) - handleNulls(timeB);
                        break;
                    case 'controversial':
                        comparison = handleNulls(calculateScoreDifference(a)) - handleNulls(calculateScoreDifference(b));
                        break;
                }
            }
            return sortDirection === 'asc' ? comparison : comparison * -1;
        });

        setFilteredFilms(workingFiltered);
    }, [films, searchTerm, selectedGenre, selectedSelector, sortBy, sortDirection]);

    const handleSortChange = useCallback((option: SortOption) => {
        if (sortBy === option) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(option);
            setSortDirection(['clubRating', 'controversial', 'watchDate'].includes(option) ? 'desc' : 'asc');
        }
    }, [sortBy]);

    const resultsText = useMemo(() => {
        let baseText = `Showing ${filteredFilms.length}`;
        if (searchTerm || selectedGenre || selectedSelector) {
            baseText += ` films matching criteria`;
        } else {
            baseText += ` of ${films.length} total films`;
        }

        if (clubMemberNames.includes(sortBy as MemberSortOption)) {
            baseText += ` (sorted by ${getSortOptionDisplayName(sortBy)}'s rating)`;
        } else if (sortBy === 'clubRating') {
            baseText = `Showing ${filteredFilms.length} films with Club Ratings (sorted by average)`;
        } else if (sortBy === 'controversial') {
            baseText = `Showing ${filteredFilms.length} films with at least 2 ratings (sorted by score difference)`;
        } else if (sortBy !== 'watchDate' || (searchTerm || selectedGenre || selectedSelector) ) { // Add sort context unless it's default and no filters
             baseText += ` (sorted by ${getSortOptionDisplayName(sortBy)})`;
        }
        return baseText;
    }, [filteredFilms.length, films.length, searchTerm, selectedGenre, selectedSelector, sortBy]);


    return {
        filteredFilms,
        searchTerm,
        setSearchTerm,
        selectedGenre,
        setSelectedGenre,
        allGenres,
        selectedSelector,
        setSelectedSelector,
        allSelectors,
        sortBy,
        sortDirection,
        handleSortChange,
        resultsText,
    };
};