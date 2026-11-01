import { calculateClubAverage, getRatingColorClass } from './ratingUtils';
import { ClubRating } from '../types/film';

describe('ratingUtils', () => {
    describe('calculateClubAverage', () => {
        it('should calculate the average rating correctly', () => {
            const ratings: ClubRating[] = [
                { user: 'Andy', score: 8, blurb: null },
                { user: 'Gabe', score: 7, blurb: null },
                { user: 'Jacob', score: 9, blurb: null },
            ];
            expect(calculateClubAverage(ratings)).toBe(8.0);
        });

        it('should handle ratings with null scores', () => {
            const ratings: ClubRating[] = [
                { user: 'Andy', score: 8, blurb: null },
                { user: 'Gabe', score: null, blurb: null },
                { user: 'Jacob', score: 9, blurb: null },
            ];
            expect(calculateClubAverage(ratings)).toBe(8.5);
        });

        it('should return null if no valid ratings are present', () => {
            const ratings: ClubRating[] = [{ user: 'Andy', score: null, blurb: null }];
            expect(calculateClubAverage(ratings)).toBeNull();
        });

        it('should return null for an empty ratings array', () => {
            expect(calculateClubAverage([])).toBeNull();
        });

        it('should return null if ratings array is undefined', () => {
            expect(calculateClubAverage(undefined)).toBeNull();
        });

        it('should handle ratings with float scores', () => {
            const ratings: ClubRating[] = [
                { user: 'Andy', score: 7.5, blurb: null },
                { user: 'Jacob', score: 8.2, blurb: null },
            ];
            // (7.5 + 8.2) / 2 = 7.85, rounds to 7.9
            expect(calculateClubAverage(ratings)).toBe(7.9);
        });
    });

    describe('getRatingColorClass', () => {
        it('should return "text-jade-300" for ratings >= 7', () => {
            expect(getRatingColorClass(7)).toBe('text-jade-300');
            expect(getRatingColorClass(9)).toBe('text-jade-300');
        });

        it('should return "text-slate-200" for ratings >= 4 and < 7', () => {
            expect(getRatingColorClass(4)).toBe('text-slate-200');
            expect(getRatingColorClass(6.9)).toBe('text-slate-200');
        });

        it('should return "text-slate-400" for ratings < 4', () => {
            expect(getRatingColorClass(3.9)).toBe('text-slate-400');
            expect(getRatingColorClass(0)).toBe('text-slate-400');
        });

        it('should return "text-slate-400" for NaN or invalid ratings', () => {
            expect(getRatingColorClass(NaN)).toBe('text-slate-400');
            expect(getRatingColorClass('invalid')).toBe('text-slate-400');
        });
    });
});
