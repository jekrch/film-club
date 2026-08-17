import type { ListFilmSummary } from '../types/list';
import { makeFilm, makeMember } from '../test-utils/factories';
import { profileBackdropSources, resolveBackdropFilm } from './profileBackdrop';

/**
 * What a profile banner ends up drawing, across the two things a member can ask
 * for and the several states a named film can be in.
 */

const clubFilm = makeFilm({
    imdbID: 'tt0110912',
    title: 'Pulp Fiction',
    year: '1994',
    poster: 'https://example.com/pulp.jpg',
    backdropImages: ['https://example.com/pulp-still.jpg'],
});

const topRated = makeFilm({
    imdbID: 'tt0068646',
    title: 'The Godfather',
    poster: 'https://example.com/godfather.jpg',
    backdropImages: ['https://example.com/godfather-still.jpg'],
});

const summary: ListFilmSummary = {
    imdbID: 'tt0087843',
    title: 'Once Upon a Time in America',
    year: '1984',
    poster: 'https://example.com/once.jpg',
    backdropImages: ['https://example.com/once-still.jpg'],
};

const sources = { films: [clubFilm, topRated], summaries: { [summary.imdbID]: summary } };

describe('resolveBackdropFilm', () => {
    it('reads a club film from films.json, and marks it as having a page here', () => {
        const resolved = resolveBackdropFilm(clubFilm.imdbID, sources);
        expect(resolved.title).toBe('Pulp Fiction');
        expect(resolved.onSite).toBe(true);
        expect(resolved.frame.images[0]).toEqual({
            url: 'https://example.com/pulp-still.jpg',
            kind: 'still',
        });
    });

    it('reads a film the club never watched from the summary cache', () => {
        const resolved = resolveBackdropFilm(summary.imdbID, sources);
        expect(resolved.title).toBe('Once Upon a Time in America');
        expect(resolved.onSite).toBe(false);
        // Its credit links out to IMDb rather than to a page that doesn't exist.
        expect(resolved.frame.onSite).toBe(false);
        expect(resolved.frame.images.map((image) => image.kind)).toEqual(['still', 'poster']);
    });

    it('gives back an id nothing knows yet without throwing', () => {
        // A film picked a minute ago has not been through the CI step that
        // fetches its artwork; that should cost the banner a panel, not the page.
        const resolved = resolveBackdropFilm('tt9999999', sources);
        expect(resolved.title).toBeNull();
        expect(resolved.frame.images).toEqual([]);
    });
});

describe('profileBackdropSources', () => {
    it('draws the top-rated films when the member has chosen nothing', () => {
        const drawn = profileBackdropSources(makeMember(), [topRated], sources);
        expect(drawn.map((frame) => frame.imdbID)).toEqual([topRated.imdbID]);
    });

    it('draws the top-rated films for a member who picked films and switched back', () => {
        const member = makeMember({ backdropMode: 'top-rated', backdropFilms: [clubFilm.imdbID] });
        expect(profileBackdropSources(member, [topRated], sources).map((f) => f.imdbID)).toEqual([
            topRated.imdbID,
        ]);
    });

    it('draws the picked films, in the order they were picked', () => {
        const member = makeMember({
            backdropMode: 'selected',
            backdropFilms: [summary.imdbID, clubFilm.imdbID],
        });
        expect(profileBackdropSources(member, [topRated], sources).map((f) => f.imdbID)).toEqual([
            summary.imdbID,
            clubFilm.imdbID,
        ]);
    });

    it('drops a picked film with no artwork and keeps the rest', () => {
        // Two panels of what they asked for beats two of theirs and one of ours.
        const member = makeMember({
            backdropMode: 'selected',
            backdropFilms: ['tt9999999', clubFilm.imdbID],
        });
        expect(profileBackdropSources(member, [topRated], sources).map((f) => f.imdbID)).toEqual([
            clubFilm.imdbID,
        ]);
    });

    it('falls back to the top-rated collage when no pick resolves at all', () => {
        // The state between picking films and CI enriching them, where the
        // alternative is an empty banner.
        const member = makeMember({ backdropMode: 'selected', backdropFilms: ['tt9999999'] });
        expect(profileBackdropSources(member, [topRated], sources).map((f) => f.imdbID)).toEqual([
            topRated.imdbID,
        ]);
    });

    it('never draws more films than the banner has panels', () => {
        const extras = [makeFilm(), makeFilm(), makeFilm(), makeFilm()];
        const member = makeMember({
            backdropMode: 'selected',
            backdropFilms: extras.map((film) => film.imdbID),
        });
        const drawn = profileBackdropSources(member, [topRated], {
            films: extras,
            summaries: {},
        });
        expect(drawn).toHaveLength(3);
    });
});
