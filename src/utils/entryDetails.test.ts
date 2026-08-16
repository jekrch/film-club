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
            cast: [{ name: 'Isabelle Adjani', character: 'Anna', tmdbId: 5309 }],
        });
    });

    it('is null when there is nothing worth opening a panel for', () => {
        // Which is the state of a film TMDb answered about and had nothing on,
        // and of one CI hasn't reached yet — the row shows no chevron for either.
        expect(summaryDetails(summary())).toBeNull();
        expect(summaryDetails(summary({ tagline: '   ', plot: null, cast: [] }))).toBeNull();
    });

    it('opens for any one of the three on its own', () => {
        expect(summaryDetails(summary({ tagline: 'Just a tagline.' }))).not.toBeNull();
        expect(summaryDetails(summary({ plot: 'Just a summary.' }))).not.toBeNull();
        expect(summaryDetails(summary({ cast: [{ name: 'Someone' }] }))).not.toBeNull();
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
            { name: 'Sigourney Weaver', character: 'Ripley', profileUrl: null, tmdbId: 10205 },
        ]);
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
