import { ClubRating } from '../types/film';

/**
 * How long after a screening an addition still belongs to that screening.
 *
 * Scores routinely go in the next morning, and that isn't news: the screening's
 * own row already shows them. A week is the shortest gap that clears those while
 * staying under the club's usual gap between films.
 */
const LATE_ADDITION_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a site stamp on a rating (`scoreAddedAt`, `blurbAddedAt`) came after
 * the grace period following the screening on `screening` (UTC midnight, as
 * `parseWatchDate` gives it). A late score is a film caught up on afterwards,
 * not one watched with the club.
 */
export const addedLate = (stamp: string | null | undefined, screening: Date): boolean =>
    !!stamp && Date.parse(stamp) > screening.getTime() + LATE_ADDITION_GRACE_DAYS * DAY_MS;

/**
 * Calculates the average club rating from the provided scores.
 * Only considers non-null numeric scores.
 * Returns the average formatted to one decimal place, or null if no valid scores exist.
 */
export const calculateClubAverage = (ratings: ClubRating[] | undefined): number | null => {
    if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
        return null; // No ratings available or empty array
    }

    let sum = 0;
    let count = 0;

    // Iterate through the array of ratings
    ratings.forEach((rating) => {
        // Check if score is a valid number (not null and actually a number type)
        if (rating.score !== null && typeof rating.score === 'number' && !isNaN(rating.score)) {
            sum += rating.score;
            count++;
        }
    });

    if (count === 0) {
        return null; // No valid scores to average
    }

    const average = sum / count;

    // Round to 1 decimal place
    return Math.round(average * 10) / 10;
};

// Helper function to determine rating color class for individual scores
export const getRatingColorClass = (rating: number | string): string => {
    // Ensure rating is treated as a number
    const numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;

    if (isNaN(numericRating)) {
        return 'text-slate-400'; // Default color for invalid ratings
    }

    if (numericRating >= 7) {
        return 'text-jade-300';
    } else if (numericRating >= 4) {
        return 'text-slate-200';
    } else {
        return 'text-slate-400';
    }
};
