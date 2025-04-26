import { ClubMemberRatings } from '../types/film'; 

/**
 * Calculates the average club rating from the provided scores.
 * Only considers non-null numeric scores.
 * Returns the average formatted to one decimal place, or null if no valid scores exist.
 */
export const calculateClubAverage = (ratings: ClubMemberRatings | undefined): number | null => {
  if (!ratings) {
    return null; // No movie club info or ratings available
  }

  // Get scores, ensure keys are lowercase if your type uses lowercase
  const scores = [ratings.andy, ratings.gabe, ratings.jacob, ratings.joey];
  let sum = 0;
  let count = 0;

  scores.forEach(score => {
    // Check if score is a valid number (not null and actually a number type)
    if (score !== null && typeof score === 'number' && !isNaN(score)) {
      sum += score;
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