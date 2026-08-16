import { clubFilmDetails, resolveEntryDetails, summaryDetails } from './entryDetails';
import type { ListFilmSummary } from '../types/list';
import { makeFilm } from '../test-utils/factories';

const summary = (overrides: Partial<ListFilmSummary> = {}): ListFilmSummary => ({
    imdbID: 'tt2000000',
    title: 'A Cached Film',
    year: '1981',
    poster: 'cached.jpg',
    ...overrides,
});

describe('summaryDetails', () => {
    it('carries the film’s own copy and cast through unchanged', () => {
        expect(
            summaryDetails(
                summary({
                    tagline: 'A love story of the highest order.',
                    plot: 'A woman leaves her husband.',
                    cast: [{ name: 'Isabelle Adjani', character: 'Anna', tmdbId: 5309 }],
                })
            )
        ).toEqual({
            tagline: 'A love story of the highest order.',
            plot: 'A woman leaves her husband.',
            crew: [],
            ratings: [],
            stills: [],
            cast: [
                {
                    name: 'Isabelle Adjani',
                    role: 'Anna',
                    profileUrl: null,
                    tmdbId: 5309,
                },
            ],
        });
    });

    it('is null when there is nothing worth opening a panel for', () => {
        // Which is the state of a film TMDb answered about and had nothing on,
        // and of one CI hasn't reached yet — the row shows no chevron for either.
        expect(summaryDetails(summary())).toBeNull();
        expect(summaryDetails(summary({ tagline: '   ', plot: null, cast: [] }))).toBeNull();
    });

    it('opens for any one field on its own', () => {
        expect(summaryDetails(summary({ tagline: 'Just a tagline.' }))).not.toBeNull();
        expect(summaryDetails(summary({ plot: 'Just a summary.' }))).not.toBeNull();
        expect(summaryDetails(summary({ cast: [{ name: 'Someone' }] }))).not.toBeNull();
        expect(summaryDetails(summary({ director: 'Someone' }))).not.toBeNull();
        expect(summaryDetails(summary({ crew: [{ name: 'Someone', job: 'Director' }] }))).not.toBeNull();
        expect(
            summaryDetails(summary({ ratings: [{ source: 'Rotten Tomatoes', value: '96%' }] }))
        ).not.toBeNull();
        expect(summaryDetails(summary({ backdropImages: ['still.jpg'] }))).not.toBeNull();
    });

    it('gives one card per person, however many jobs they held', () => {
        // A writer-director is one face. TMDb credits them once per job, and
        // CI stores it that way; the grouping is this module's business.
        const details = summaryDetails(
            summary({
                crew: [
                    { name: 'Andrzej Żuławski', job: 'Director', tmdbId: 40, profileUrl: 'z.jpg' },
                    { name: 'Andrzej Żuławski', job: 'Story', tmdbId: 40 },
                    { name: 'Bruno Nuytten', job: 'Director of Photography', tmdbId: 41 },
                ],
            })
        );

        expect(details?.crew).toEqual([
            { name: 'Andrzej Żuławski', role: 'Director · Story', profileUrl: 'z.jpg', tmdbId: 40 },
            { name: 'Bruno Nuytten', role: 'Cinematography', profileUrl: null, tmdbId: 41 },
        ]);
    });

    it('falls back to OMDB’s bare names before CI has fetched a crew', () => {
        // No face and nowhere to link, but the row still says who directed it.
        expect(
            summaryDetails(summary({ director: 'Andrzej Żuławski', writer: 'A Writer, B Writer' }))
                ?.crew
        ).toEqual([
            { name: 'Andrzej Żuławski', role: 'Director', profileUrl: null, tmdbId: null },
            { name: 'A Writer', role: 'Writer', profileUrl: null, tmdbId: null },
            { name: 'B Writer', role: 'Writer', profileUrl: null, tmdbId: null },
        ]);

        // Whitespace is not a credit, so it opens no panel of its own.
        expect(summaryDetails(summary({ director: '   ' }))).toBeNull();
    });

    it('passes the external scores and stills straight through', () => {
        const details = summaryDetails(
            summary({
                ratings: [{ source: 'Rotten Tomatoes', value: '96%' }],
                backdropImages: ['a.jpg', 'b.jpg'],
            })
        );
        expect(details?.ratings).toEqual([{ source: 'Rotten Tomatoes', value: '96%' }]);
        expect(details?.stills).toEqual(['a.jpg', 'b.jpg']);
    });
});

describe('clubFilmDetails', () => {
    it('resolves each actor’s TMDb id through the film’s personProfiles map', () => {
        // Club films key person ids by normalized name rather than storing them
        // on the cast entry; the panel wants them per actor either way.
        const film = makeFilm({
            imdbID: 'tt0000001',
            tagline: 'In space no one can hear you scream.',
            cast: [{ name: 'Sigourney Weaver', character: 'Ripley' }],
            personProfiles: { 'sigourney weaver': { tmdbId: 10205 } },
        });

        const details = clubFilmDetails(film);
        expect(details?.tagline).toBe('In space no one can hear you scream.');
        expect(details?.cast).toEqual([
            { name: 'Sigourney Weaver', role: 'Ripley', profileUrl: null, tmdbId: 10205 },
        ]);
    });

    it('takes its crew, scores and stills from the club record', () => {
        const film = makeFilm({
            imdbID: 'tt0000001',
            director: 'Mike Leigh',
            writer: 'Mike Leigh',
            ratings: [{ source: 'Internet Movie Database', value: '7.7/10' }],
            backdropImage: 'curated.jpg',
            backdropImages: ['tmdb-1.jpg'],
            personProfiles: { 'mike leigh': { tmdbId: 55366, profileUrl: 'leigh.jpg' } },
        });

        const details = clubFilmDetails(film);
        // Directed and wrote it: one card, both roles, linked through the film's
        // own personProfiles map.
        expect(details?.crew).toEqual([
            {
                name: 'Mike Leigh',
                role: 'Director · Writer',
                profileUrl: 'leigh.jpg',
                tmdbId: 55366,
            },
        ]);
        expect(details?.ratings).toEqual([
            { source: 'Internet Movie Database', value: '7.7/10' },
        ]);
        // The curated backdrop leads, as it does on the film's own page.
        expect(details?.stills).toEqual(['curated.jpg', 'tmdb-1.jpg']);
    });

    it('leaves an unresolvable name without an id, rather than a dead link', () => {
        const film = makeFilm({ imdbID: 'tt0000001', cast: [{ name: 'Nobody In Particular' }] });
        expect(clubFilmDetails(film)?.cast[0].tmdbId).toBeNull();
    });
});

describe('resolveEntryDetails', () => {
    it('prefers the club record and never mixes the two', () => {
        const film = makeFilm({ imdbID: 'tt0000001', plot: 'The club’s copy.' });
        expect(resolveEntryDetails(film, summary({ plot: 'The cache’s copy.' }))?.plot).toBe(
            'The club’s copy.'
        );
    });

    it('falls back to the cache, and to nothing at all', () => {
        expect(resolveEntryDetails(undefined, summary({ plot: 'Cached.' }))?.plot).toBe('Cached.');
        expect(resolveEntryDetails(undefined, undefined)).toBeNull();
    });
});
