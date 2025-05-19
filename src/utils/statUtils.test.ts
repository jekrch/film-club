import {
  parseRuntime,
  formatTotalRuntime,
  formatAverage,
  countValidRatings,
  getRankString,
  calculateMemberStats
} from './statUtils';
import { Film, ClubRating } from '../types/film'; 
import { calculateClubAverage } from './ratingUtils'; 

// Mock the imported calculateClubAverage function
jest.mock('./ratingUtils', () => ({
  calculateClubAverage: jest.fn(),
}));

describe('statUtils', () => {
  describe('parseRuntime', () => {
    it('should parse runtime string "X min" to number', () => {
      expect(parseRuntime('120 min')).toBe(120);
    });

    it('should parse runtime string with only numbers to number', () => {
      expect(parseRuntime('95')).toBe(95);
    });

    it('should parse runtime string "Xh Ym" to total minutes (interpreting only numbers)', () => {
      // Current implementation only extracts numbers, so "2h 30m" -> 230.
      // If specific parsing for "h" and "m" was intended, the function would be different.
      // Based on current implementation:
      expect(parseRuntime('2h 30m')).toBe(230); // This might be unexpected based on "h" "m"
      expect(parseRuntime('1h')).toBe(1); // This would be 1 if "h" implies hours.
                                        // Test based on current: extracts numbers '1'.
    });

    it('should parse runtime string with " mins" to number', () => {
        expect(parseRuntime('100 mins')).toBe(100);
    });


    it('should return null for invalid runtime string', () => {
      expect(parseRuntime('abc')).toBeNull();
      expect(parseRuntime('N/A')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseRuntime('')).toBeNull();
    });

    it('should return null for undefined or null input', () => {
      expect(parseRuntime(undefined)).toBeNull();
      expect(parseRuntime(null)).toBeNull();
    });
  });

  describe('formatTotalRuntime', () => {
    it('should format total minutes to "X hrs Y min"', () => {
      expect(formatTotalRuntime(150)).toBe('2 hrs 30 min');
    });

    it('should format total minutes to "X hr Y min" for 1 hour', () => {
      expect(formatTotalRuntime(90)).toBe('1 hr 30 min');
    });

    it('should format total minutes to "Y min" if less than 1 hour', () => {
      expect(formatTotalRuntime(45)).toBe('45 min');
    });

    it('should format total minutes to "X hrs" if minutes are 0', () => {
      expect(formatTotalRuntime(120)).toBe('2 hrs');
    });

     it('should format total minutes to "X hr" if minutes are 0 and hour is 1', () => {
      expect(formatTotalRuntime(60)).toBe('1 hr');
    });

    it('should return null for 0 minutes', () => {
      expect(formatTotalRuntime(0)).toBeNull();
    });

    it('should return null for negative minutes', () => {
      expect(formatTotalRuntime(-30)).toBeNull();
    });

    it('should return null for null or NaN input', () => {
      expect(formatTotalRuntime(null)).toBeNull();
      expect(formatTotalRuntime(NaN)).toBeNull();
    });
  });

  describe('formatAverage', () => {
    it('should format number to string with default 1 digit', () => {
      expect(formatAverage(7.86)).toBe('7.9');
      expect(formatAverage(7.84)).toBe('7.8');
      expect(formatAverage(7)).toBe('7.0');
    });

    it('should format number to string with specified digits', () => {
      expect(formatAverage(7.865, 2)).toBe('7.87');
      expect(formatAverage(7.123, 0)).toBe('7');
    });

    it('should return null for null, undefined, or NaN input', () => {
      expect(formatAverage(null)).toBeNull();
      expect(formatAverage(undefined)).toBeNull();
      expect(formatAverage(NaN)).toBeNull();
    });
  });

  describe('countValidRatings', () => {
    it('should count valid ratings correctly', () => {
      const ratings: ClubRating[] = [
        { user: 'A', score: 8, blurb: null },
        { user: 'B', score: 7, blurb: null },
        { user: 'C', score: null, blurb: null },
        { user: 'D', score: NaN, blurb: null },
        { user: 'E', score: 9, blurb: null },
      ];
      expect(countValidRatings(ratings)).toBe(3);
    });

    it('should return 0 if all ratings are invalid', () => {
      const ratings: ClubRating[] = [
        { user: 'A', score: null, blurb: null },
        { user: 'B', score: NaN, blurb: null },
      ];
      expect(countValidRatings(ratings)).toBe(0);
    });

    it('should return 0 for an empty ratings array', () => {
      expect(countValidRatings([])).toBe(0);
    });

    it('should return 0 if ratings array is undefined', () => {
      expect(countValidRatings(undefined)).toBe(0);
    });
  });

  describe('getRankString', () => {
    const allScores = [10, 8, 9, 7, 8.5, null, NaN];

    it('should return correct rank string when higher is better', () => {
      const validScores = [10, 9, 8.5, 8, 7]; // sorted for checking
      expect(getRankString(9, allScores, true)).toBe(`2/${validScores.length}`);
      expect(getRankString(10, allScores, true)).toBe(`1/${validScores.length}`);
      expect(getRankString(7, allScores, true)).toBe(`5/${validScores.length}`);
      expect(getRankString(8.5, allScores, true)).toBe(`3/${validScores.length}`);
    });

    it('should return correct rank string when lower is better', () => {
      const validScores = [7, 8, 8.5, 9, 10]; // sorted for checking
      expect(getRankString(9, allScores, false)).toBe(`4/${validScores.length}`);
      expect(getRankString(7, allScores, false)).toBe(`1/${validScores.length}`);
      expect(getRankString(10, allScores, false)).toBe(`5/${validScores.length}`);
    });

    it('should return null if value is null or NaN', () => {
      expect(getRankString(null, allScores, true)).toBeNull();
      expect(getRankString(NaN, allScores, true)).toBeNull();
    });

    it('should return null if there are less than 2 valid values in allValues', () => {
      expect(getRankString(5, [5, null, NaN], true)).toBeNull();
      expect(getRankString(5, [5], true)).toBeNull();
      expect(getRankString(5, [], true)).toBeNull();
    });

    it('should handle value not present in allValues (rank should be based on sorted position or null if out of bounds)', () => {
        // Current implementation requires exact match, so it would return null if value not found
        // unless there's a floating point issue it tries to correct.
        const values = [10, 8, 7];
        expect(getRankString(7.5, values, true)).toBeNull(); // 7.5 is not in [10, 8, 7]
    });

     it('should handle floating point numbers correctly for rank', () => {
        const floatValues = [0.1, 0.2, 0.3, 0.05];
        // sorted higherIsBetter: [0.3, 0.2, 0.1, 0.05]
        expect(getRankString(0.2, floatValues, true)).toBe(`2/${floatValues.length}`);
        // sorted lowerIsBetter: [0.05, 0.1, 0.2, 0.3]
        expect(getRankString(0.2, floatValues, false)).toBe(`3/${floatValues.length}`);
    });

    it('should handle exact matches for rank, even with potential floating point issues (within epsilon)', () => {
        const values = [10.000000001, 8, 7];
        // Test with a value very close to one in the list
        expect(getRankString(10.0000000011, values, true)).toBe(`1/${values.length}`);
    });

  });

  describe('calculateMemberStats', () => {
    const mockCalculateClubAverage = calculateClubAverage as jest.Mock;

    beforeEach(() => {
      // Reset mocks before each test
      mockCalculateClubAverage.mockReset();
    });

    const filmsData: Film[] = [
        // @ts-ignore
      {
        title: 'Film A', imdbID: 'tt001', year: '2020', genre: 'Action, Drama', runtime: '120 min', country: 'USA, UK', language: 'English, Spanish',
        poster: 'url1', director: 'Dir A', writer: 'Writer A', actors: 'Actor A', plot: 'Plot A',
        movieClubInfo: {
          selector: 'Alice', watchDate: '2023-01-01', clubRatings: [
            { user: 'Alice', score: 8, blurb: null },
            { user: 'Bob', score: 7, blurb: null },
            { user: 'Charlie', score: 9, blurb: null },
          ]
        }
      },
      // @ts-ignore
      {
        title: 'Film B', imdbID: 'tt002', year: '2021', genre: 'Comedy', runtime: '90 min', country: 'Canada', language: 'French',
        poster: 'url2', director: 'Dir B', writer: 'Writer B', actors: 'Actor B', plot: 'Plot B',
        movieClubInfo: {
          selector: 'Bob', watchDate: '2023-02-01', clubRatings: [
            { user: 'Alice', score: 6, blurb: null },
            { user: 'Bob', score: 8, blurb: null },
          ]
        }
      },
      // @ts-ignore
      {
        title: 'Film C', imdbID: 'tt003', year: '1999', genre: 'Action, Sci-Fi', runtime: '150 min', country: 'USA', language: 'English',
        poster: 'url3', director: 'Dir C', writer: 'Writer C', actors: 'Actor C', plot: 'Plot C',
        movieClubInfo: {
          selector: 'Alice', watchDate: '2023-03-01', clubRatings: [
            { user: 'Alice', score: 9, blurb: null },
            { user: 'Bob', score: 9, blurb: null },
            { user: 'Charlie', score: null, blurb: null }, // Null score
          ]
        }
      },
       // @ts-ignore
       { // Film with only one rating (for avgSelectedScore test)
        title: 'Film D', imdbID: 'tt004', year: '2022', genre: 'Drama', runtime: '100 min', country: 'Germany', language: 'German',
        poster: 'url4', director: 'Dir D', writer: 'Writer D', actors: 'Actor D', plot: 'Plot D',
        movieClubInfo: {
          selector: 'Alice', watchDate: '2023-04-01', clubRatings: [
            { user: 'Alice', score: 7, blurb: null },
          ]
        }
      },
      // @ts-ignore
      { // Film with N/A runtime, genre
        title: 'Film E', imdbID: 'tt005', year: '2000', genre: 'N/A', runtime: 'N/A', country: 'N/A', language: 'N/A',
        poster: 'url5', director: 'Dir E', writer: 'Writer E', actors: 'Actor E', plot: 'Plot E',
        movieClubInfo: {
          selector: 'Alice', watchDate: '2023-05-01', clubRatings: [
            { user: 'Alice', score: 5, blurb: null },
            { user: 'Bob', score: 6, blurb: null },
          ]
        }
      }
    ];

    it('should calculate stats correctly for a member', () => {
      // Alice selected Film A, Film C, Film D, Film E
      // Film A club average = (8+7+9)/3 = 8
      // Film C club average = (9+9)/2 = 9 (Alice score 9, Bob score 9, Charlie null)
      // Film D club average = not calculated (only 1 rating)
      // Film E club average = (5+6)/2 = 5.5
      mockCalculateClubAverage
        .mockImplementation((ratings: ClubRating[] | undefined) => {
            if (!ratings) return null;
            const validScores = ratings.filter(r => r.score !== null).map(r => r.score as number);
            if (validScores.length === 0) return null;
            const sum = validScores.reduce((acc, s) => acc + s, 0);
            return parseFloat((sum / validScores.length).toFixed(1)); // Simplified mock
        });


      const statsAlice = calculateMemberStats('Alice', filmsData);

      // Total Selections
      expect(statsAlice.totalSelections).toBe(4); // A, C, D, E

      // Runtime (Film A: 120, Film C: 150, Film D: 100, Film E: N/A)
      expect(statsAlice.totalRuntime).toBe(120 + 150 + 100); // 370
      expect(statsAlice.avgRuntime).toBeCloseTo(370 / 3); // Film E has N/A runtime

      // Top Genres (Alice's selections: A, C, D, E)
      // A: Action, Drama
      // C: Action, Sci-Fi
      // D: Drama
      // E: N/A
      // Counts: Action: 2, Drama: 2, Sci-Fi: 1. Sorted: Action, Drama, Sci-Fi
      expect(statsAlice.topGenres).toEqual([
        { genre: 'Action', count: 2 },
        { genre: 'Drama', count: 2 },
        { genre: 'Sci-Fi', count: 1 },
      ]);

      // Avg Selected Score (Club Averages for Alice's selections with >=2 ratings)
      // Film A (3 ratings): avg 8 (mocked result would be (8+7+9)/3 = 8.0 )
      // Film C (2 valid ratings): avg 9 (mocked result would be (9+9)/2 = 9.0 )
      // Film D (1 rating): excluded
      // Film E (2 ratings): avg 5.5 (mocked result would be (5+6)/2 = 5.5)
      // Need to ensure mockCalculateClubAverage is called for Film A, C, E
      expect(mockCalculateClubAverage).toHaveBeenCalledWith(filmsData[0].movieClubInfo?.clubRatings);
      expect(mockCalculateClubAverage).toHaveBeenCalledWith(filmsData[2].movieClubInfo?.clubRatings);
      expect(mockCalculateClubAverage).toHaveBeenCalledWith(filmsData[4].movieClubInfo?.clubRatings);
      // Manually re-calculate based on *mock* behavior for avgSelectedScore
      const avgSelectedForAlice = (8 + 9 + 5.5) / 3;
      expect(statsAlice.avgSelectedScore).toBeCloseTo(avgSelectedForAlice);


      // Avg Given Score (Alice's scores: Film A: 8, Film B: 6, Film C: 9, Film D: 7, Film E: 5)
      const aliceGivenScores = [8, 6, 9, 7, 5];
      expect(statsAlice.avgGivenScore).toBeCloseTo(aliceGivenScores.reduce((a, b) => a + b, 0) / aliceGivenScores.length); // (8+6+9+7+5)/5 = 7

      // Divergence (Alice)
      // Film A: Alice 8, Others (7,9) -> avg 8. Divergence: 8 - 8 = 0
      // Film B: Alice 6, Others (8) -> avg 8. Divergence: 6 - 8 = -2
      // Film C: Alice 9, Others (9) -> avg 9. Divergence: 9 - 9 = 0
      // Film D: Alice 7, Others () -> no divergence calculated
      // Film E: Alice 5, Others (6) -> avg 6. Divergence: 5 - 6 = -1
      // Total Signed: 0 + (-2) + 0 + (-1) = -3. Count: 4. Avg Signed: -3 / 4 = -0.75
      // Total Absolute: |0| + |-2| + |0| + |-1| = 0 + 2 + 0 + 1 = 3. Count: 4. Avg Abs: 3 / 4 = 0.75
      expect(statsAlice.avgDivergence).toBeCloseTo(-0.75);
      expect(statsAlice.avgAbsoluteDivergence).toBeCloseTo(0.75);


      // Language Count (Alice's selections: A, C, D, E)
      // A: English (takes first)
      // C: English
      // D: German
      // E: N/A
      // Unique: English, German. Count: 2
      expect(statsAlice.languageCount).toBe(2);

      // Country Count (Alice's selections: A, C, D, E)
      // A: USA (takes first)
      // C: USA
      // D: Germany
      // E: N/A
      // Unique: USA, Germany. Count: 2
      expect(statsAlice.countryCount).toBe(2);
      expect(statsAlice.selectionCountryCount).toBe(2);

      // Avg Selection Year (Alice's selections: A(2020), C(1999), D(2022), E(2000))
      // Years: 2020, 1999, 2022, 2000
      const aliceSelectionYears = [2020, 1999, 2022, 2000];
      expect(statsAlice.avgSelectionYear).toBeCloseTo(aliceSelectionYears.reduce((a,b) => a+b,0) / aliceSelectionYears.length);
    });

    it('should calculate stats correctly for another member (Bob)', () => {
        // Bob selected Film B
        // Film B club average = (6+8)/2 = 7
        mockCalculateClubAverage
          .mockImplementation((ratings: ClubRating[] | undefined) => {
              if (!ratings) return null;
              const validScores = ratings.filter(r => r.score !== null).map(r => r.score as number);
              if (validScores.length === 0) return null;
              const sum = validScores.reduce((acc, s) => acc + s, 0);
              return parseFloat((sum / validScores.length).toFixed(1)); // Simplified mock
          });

        const statsBob = calculateMemberStats('Bob', filmsData);

        // Total Selections
        expect(statsBob.totalSelections).toBe(1); // B

        // Runtime (Film B: 90 min)
        expect(statsBob.totalRuntime).toBe(90);
        expect(statsBob.avgRuntime).toBe(90);

        // Top Genres (Bob's selections: B)
        // B: Comedy
        expect(statsBob.topGenres).toEqual([{ genre: 'Comedy', count: 1 }]);

        // Avg Selected Score (Club Averages for Bob's selections with >=2 ratings)
        // Film B (2 ratings): avg 7 (mocked: (6+8)/2 = 7.0)
        expect(mockCalculateClubAverage).toHaveBeenCalledWith(filmsData[1].movieClubInfo?.clubRatings);
        expect(statsBob.avgSelectedScore).toBeCloseTo(7.0);

        // Avg Given Score (Bob's scores: Film A: 7, Film B: 8, Film C: 9, Film E: 6)
        const bobGivenScores = [7, 8, 9, 6];
        expect(statsBob.avgGivenScore).toBeCloseTo(bobGivenScores.reduce((a,b) => a+b,0) / bobGivenScores.length); // (7+8+9+6)/4 = 7.5

        // Divergence (Bob)
        // Film A: Bob 7, Others (Alice 8, Charlie 9) -> avg 8.5. Divergence: 7 - 8.5 = -1.5
        // Film B: Bob 8, Others (Alice 6) -> avg 6. Divergence: 8 - 6 = 2
        // Film C: Bob 9, Others (Alice 9) -> avg 9. Divergence: 9 - 9 = 0
        // Film E: Bob 6, Others (Alice 5) -> avg 5. Divergence: 6 - 5 = 1
        // Total Signed: -1.5 + 2 + 0 + 1 = 1.5. Count: 4. Avg Signed: 1.5 / 4 = 0.375
        // Total Absolute: |-1.5| + |2| + |0| + |1| = 1.5 + 2 + 0 + 1 = 4.5. Count: 4. Avg Abs: 4.5 / 4 = 1.125
        expect(statsBob.avgDivergence).toBeCloseTo(0.375);
        expect(statsBob.avgAbsoluteDivergence).toBeCloseTo(1.125);

        // Language Count (Bob's selections: B)
        // B: French
        expect(statsBob.languageCount).toBe(1);

        // Country Count (Bob's selections: B)
        // B: Canada
        expect(statsBob.countryCount).toBe(1);
        expect(statsBob.selectionCountryCount).toBe(1);

        // Avg Selection Year (Bob's selections: B(2021))
        expect(statsBob.avgSelectionYear).toBe(2021);
    });


    it('should return zero/null stats for a member with no selections', () => {
      const statsNoSelection = calculateMemberStats('Charlie', filmsData); // Charlie selected nothing

      expect(statsNoSelection.totalSelections).toBe(0);
      expect(statsNoSelection.totalRuntime).toBeNull();
      expect(statsNoSelection.avgRuntime).toBeNull();
      expect(statsNoSelection.topGenres).toEqual([]);
      expect(statsNoSelection.avgSelectedScore).toBeNull();
      // Avg Given Score (Charlie's scores: Film A: 9, Film C: null)
      expect(statsNoSelection.avgGivenScore).toBe(9); // Only one valid score
      // Divergence (Charlie)
      // Film A: Charlie 9, Others (Alice 8, Bob 7) -> avg 7.5. Divergence: 9 - 7.5 = 1.5
      // Film C: Charlie null score - no divergence
      expect(statsNoSelection.avgDivergence).toBeCloseTo(1.5);
      expect(statsNoSelection.avgAbsoluteDivergence).toBeCloseTo(1.5);
      expect(statsNoSelection.languageCount).toBe(0);
      expect(statsNoSelection.countryCount).toBe(0);
      expect(statsNoSelection.selectionCountryCount).toBe(0);
      expect(statsNoSelection.avgSelectionYear).toBeNull();
    });

    it('should handle films with missing movieClubInfo or clubRatings gracefully', () => {
        const filmsWithMissingData: Film[] = [
            // @ts-ignore
            { title: 'Film X', imdbID: 'tt00X', year: '2024', movieClubInfo: { selector: 'David' } }, // Missing clubRatings
            // @ts-ignore
            { title: 'Film Y', imdbID: 'tt00Y', year: '2024', }
        ];
        const stats = calculateMemberStats('David', filmsWithMissingData);
        expect(stats.totalSelections).toBe(1); // Only Film X
        expect(stats.avgSelectedScore).toBeNull();
        expect(stats.avgGivenScore).toBeNull();
        expect(stats.avgDivergence).toBeNull();
    });

    it('should handle case-insensitivity for memberName', () => {
        mockCalculateClubAverage.mockReturnValue(7.5); // Arbitrary consistent return for simplicity
        const statsUpper = calculateMemberStats('ALICE', filmsData);
        const statsLower = calculateMemberStats('alice', filmsData);
        expect(statsUpper.totalSelections).toBe(statsLower.totalSelections);
        expect(statsUpper.avgGivenScore).toBe(statsLower.avgGivenScore);
    });

    it('should correctly calculate averages when some values are null or counts are zero', () => {
        const filmsForAvgTest: Film[] = [
            // @ts-ignore
            { title: 'No Runtime Film', imdbID: 'rt01', year: '2000', movieClubInfo: { selector: 'Tester', clubRatings: [{user: 'Tester', score: 8, blurb: null}, {user: 'Other', score: 7, blurb: null}] }, runtime: null },
            // @ts-ignore
            { title: 'No Score Film', imdbID: 'sc01', year: '2000', movieClubInfo: { selector: 'Tester', clubRatings: [{user: 'Tester', score: null, blurb: null}] }, runtime: '100 min'},
            // @ts-ignore
            { title: 'No Year Film', imdbID: 'yr01', year: '', movieClubInfo: { selector: 'Tester' }, runtime: '100 min' }
        ];
        mockCalculateClubAverage.mockImplementation((ratings: ClubRating[] | undefined) => {
            if (ratings && ratings.length > 0 && ratings[0].user === 'Tester' && ratings[0].score === 8) return 7.5; // for No Runtime Film
            return null;
        });

        const stats = calculateMemberStats('Tester', filmsForAvgTest);
        expect(stats.totalSelections).toBe(3);
        expect(stats.totalRuntime).toBe(200); // From the two films with runtime
        expect(stats.avgRuntime).toBe(100);   // Avg of 100 and 100
        expect(stats.avgSelectedScore).toBe(7.5); // Only from "No Runtime Film"
        expect(stats.avgGivenScore).toBe(8);      // Only score from "No Runtime Film"
        expect(stats.avgSelectionYear).toBe(2000); // Only from "No Runtime Film" and "No Score Film"
    });

  });
});