import { posterFigures, posterFilename, yearOnYear } from './format';

const years = (...counts: number[]) =>
    counts.map((withClub, i) => ({ year: 2026 - counts.length + 1 + i, withClub }));

describe('yearOnYear', () => {
    it('says nothing without a history, and greets a first year', () => {
        expect(yearOnYear([], false)).toBeNull();
        expect(yearOnYear(years(5), false)).toBe('Your first year with the club.');
    });

    it('names the last year that matched a rise, when it was a while back', () => {
        // 2020–2026: 16, 16, 10, 8, 7, 7, 11
        expect(yearOnYear(years(16, 16, 10, 8, 7, 7, 11), false)).toBe('Your most since 2021.');
    });

    it('calls a rise past every earlier year the most, given a few years behind it', () => {
        expect(yearOnYear(years(3, 5, 9), false)).toBe('Your most in any year with the club.');
        expect(yearOnYear(years(5, 9), false)).toBe('Up from 5 in 2025.');
    });

    it('keeps to last year for a rise that only passes recent years', () => {
        expect(yearOnYear(years(9, 4, 6), false)).toBe('Up from 4 in 2025.');
    });

    it('reads level and lower years, and never calls a running year down', () => {
        expect(yearOnYear(years(7, 7), false)).toBe('The same as in 2025.');
        expect(yearOnYear(years(9, 7), false)).toBe('Down from 9 in 2025.');
        expect(yearOnYear(years(9, 7), true)).toBe('Two more to match 2025.');
    });

    it('compares with their last year with films when they missed the one before', () => {
        const gap = [
            { year: 2023, withClub: 8 },
            { year: 2026, withClub: 5 },
        ];
        expect(yearOnYear(gap, false)).toBe('Down from 8 in 2023.');
        expect(yearOnYear([gap[0], { year: 2026, withClub: 8 }], false)).toBe(
            'The same as in 2023.'
        );
    });
});

describe('posterFigures', () => {
    it('prints the films, the average and the trophies', () => {
        expect(posterFigures({ films: 48, averageGiven: 6.43, trophies: 3 })).toEqual([
            { value: '48', label: 'films' },
            { value: '6.4', label: 'average' },
            { value: '3', label: 'trophies' },
        ]);
    });

    it('leaves out a missing average and an empty trophy shelf, and counts one in the singular', () => {
        expect(posterFigures({ films: 1, averageGiven: null, trophies: 0 })).toEqual([
            { value: '1', label: 'film' },
        ]);
        expect(posterFigures({ films: 7, averageGiven: 5, trophies: 1 })).toEqual([
            { value: '7', label: 'films' },
            { value: '5.0', label: 'average' },
            { value: '1', label: 'trophy' },
        ]);
    });
});

describe('posterFilename', () => {
    it('names the file for the year and the member', () => {
        expect(posterFilename(2026, 'Jacob')).toMatch(/^criterion-club-2026-[a-z]+\.jpg$/);
    });
});
