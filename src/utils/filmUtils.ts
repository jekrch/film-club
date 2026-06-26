import { ClubRating, Film } from '../types/film';

export interface PersonCredit {
    film: Film;
    roles: string[];
}

export const parseGenres = (genreString: string | undefined | null): string[] => {
    if (!genreString || typeof genreString !== 'string') return [];
    return genreString.split(',').map(g => g.trim()).filter(g => g);
};

export const formatRuntime = (runtimeString: string | undefined | null): string | null => {
    if (!runtimeString || typeof runtimeString !== 'string' || !runtimeString.includes('min')) {
        return null;
    }
    const minutes = parseInt(runtimeString);
    if (isNaN(minutes)) {
        return null;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    let result = '';
    if (hours > 0) {
        result += `${hours}h `;
    }
    result += `${mins}m`;
    return result.trim();
};

export const getImdbRatingDisplay = (rating: string | undefined | null): string | null => {
    if (!rating || rating === 'N/A') return null;
    const parsed = parseFloat(rating);
    return isNaN(parsed) ? null : parsed.toFixed(1);
};

/**
 * Formats a USD amount (e.g. a TMDb budget/revenue figure) as a compact currency
 * string. Returns null for missing, non-numeric, or zero values (TMDb uses 0 to
 * mean "unknown").
 */
export const formatCurrency = (amount: number | undefined | null): string | null => {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return null;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(amount);
};

export const countValidRatings = (clubRatings: ClubRating[] | undefined): number => {
    if (!clubRatings || !Array.isArray(clubRatings)) return 0;
    return clubRatings.filter(rating => rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score)).length;
};

/**
 * Renders an interval between two watch dates as a short, human-readable phrase
 * (e.g. "11 days", "3 weeks", "2 months"). Used to show how much time passed
 * between consecutive club screenings. Returns null for invalid input.
 */
export const formatDayGap = (days: number | null | undefined): string | null => {
    if (typeof days !== 'number' || isNaN(days) || days < 0) return null;
    if (days === 0) return 'Same day';
    if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
    if (days < 60) {
        const weeks = Math.round(days / 7);
        return `${weeks} week${weeks === 1 ? '' : 's'}`;
    }
    if (days < 365) {
        const months = Math.round(days / 30);
        return `${months} month${months === 1 ? '' : 's'}`;
    }
    const years = Math.round((days / 365) * 10) / 10;
    return `${years} year${years === 1 ? '' : 's'}`;
};

export const parseWatchDate = (dateString: string | null | undefined): Date | null => {
    // ... (date parsing logic) ...
    if (!dateString) return null;
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) { console.warn(`Invalid date format: ${dateString}`); return null; }
    const [monthStr, dayStr, yearStr] = parts;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    let year = parseInt(yearStr, 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) { console.warn(`Invalid date parts: ${dateString}`); return null; }
    if (month < 1 || month > 12 || day < 1 || day > 31) { console.warn(`Invalid month/day: ${dateString}`); return null; }
    if (yearStr.length <= 2 && year >= 0 && year < 100) { year += 2000; }
    if (year < 2000) { console.warn(`Year before 2000: ${dateString}`); return null; }
    try {
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        if (dateObj.getUTCFullYear() === year && dateObj.getUTCMonth() === month - 1 && dateObj.getUTCDate() === day) {
            return dateObj;
        } else {
            console.warn(`Invalid date construction from parts: ${dateString}`); return null;
        }
    } catch (e) { console.error(`Error creating Date: ${dateString}`, e); return null; }
};

export const getAllFilmCreditsForPerson = (personName: string, allFilms: Film[]): PersonCredit[] => {
    const credits: PersonCredit[] = [];
    const trimmedPersonName = personName.trim().toLowerCase();
    if (!trimmedPersonName) return credits;

    allFilms.forEach(f => {
        const rolesForFilm: string[] = [];
        const addRole = (roleName: string) => {
            if (!rolesForFilm.includes(roleName)) rolesForFilm.push(roleName);
        };
        const checkCreditField = (creditField: string | undefined, roleName: string) => {
            if (creditField && typeof creditField === 'string' && creditField.toLowerCase().split(',').map(n => n.trim()).includes(trimmedPersonName)) {
                addRole(roleName);
            }
        };

        checkCreditField(f.director, 'Director');
        checkCreditField(f.writer, 'Writer');
        checkCreditField(f.actors, 'Actor');
        checkCreditField(f.cinematographer, 'Cinematographer');
        checkCreditField(f.editor, 'Editor');
        checkCreditField(f.productionDesigner, 'Production Designer');
        checkCreditField(f.musicComposer, 'Music Composer');
        checkCreditField(f.costumeDesigner, 'Costume Designer');

        // Also scan the TMDb cast list so people credited only there (not in the
        // shorter "Stars" string) are still grouped across films.
        if (Array.isArray(f.cast) && f.cast.some(member => member?.name?.trim().toLowerCase() === trimmedPersonName)) {
            addRole('Actor');
        }

        if (rolesForFilm.length > 0) {
            credits.push({ film: f, roles: rolesForFilm });
        }
    });
    return credits;
};