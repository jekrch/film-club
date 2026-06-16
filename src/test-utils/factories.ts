import { ClubRating, Film, MovieClubDetails } from '../types/film';
import { TeamMember } from '../types/team';

/**
 * Typed fixture factories for tests.
 *
 * These let test files build valid `Film` / `TeamMember` objects from a small
 * `Partial<>` override instead of hand-writing every required field (or reaching
 * for `@ts-ignore`/`@ts-expect-error`). The fixtures stay fully typed, so a real
 * signature change breaks the tests loudly instead of silently.
 */

let filmCounter = 0;

/** Builds a complete {@link Film}, overriding only the fields a test cares about. */
export const makeFilm = (overrides: Partial<Film> = {}): Film => {
    filmCounter += 1;
    return {
        title: `Film ${filmCounter}`,
        year: '2020',
        released: '01 Jan 2020',
        runtime: '120 min',
        genre: 'Drama',
        director: 'Director',
        writer: 'Writer',
        actors: 'Actors',
        plot: 'Plot',
        language: 'English',
        country: 'USA',
        poster: 'https://example.com/poster.jpg',
        ratings: [],
        imdbID: `tt${String(filmCounter).padStart(7, '0')}`,
        type: 'movie',
        ...overrides,
    };
};

/** Builds a {@link MovieClubDetails} block for use in {@link makeFilm} overrides. */
export const makeClubInfo = (overrides: Partial<MovieClubDetails> = {}): MovieClubDetails => ({
    selector: 'Andy',
    watchDate: '01/01/2020',
    clubRatings: [],
    ...overrides,
});

/** Builds a {@link ClubRating} with sensible defaults. */
export const makeRating = (overrides: Partial<ClubRating> = {}): ClubRating => ({
    user: 'andy',
    score: 8,
    blurb: null,
    ...overrides,
});

/** Builds a complete {@link TeamMember}, overriding only what a test needs. */
export const makeMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
    name: 'Andy',
    title: 'Member',
    bio: '',
    image: '',
    ...overrides,
});
