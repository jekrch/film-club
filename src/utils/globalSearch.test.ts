import {
    buildSearchIndex,
    highlightRuns,
    queryWords,
    searchIndex,
    searchSuggestions,
    type SearchSources,
} from './globalSearch';
import type { FilmListDefinition } from '../types/list';
import type { WatchedEntry } from '../types/watched';
import { makeClubInfo, makeFilm, makeMember, makeRating } from '../test-utils/factories';

const samurai = makeFilm({
    imdbID: 'tt0000101',
    title: 'Seven Samurai',
    year: '1954',
    director: 'Akira Kurosawa',
    actors: 'Toshiro Mifune, Takashi Shimura',
    genre: 'Action, Drama',
    movieClubInfo: makeClubInfo({
        selector: 'Mark',
        watchDate: '09/01/2026',
        clubRatings: [
            makeRating({
                user: 'gabe',
                score: 9,
                blurb: 'The rain battle is the best thing ever filmed.',
            }),
            makeRating({ user: 'andy', score: 7, blurb: null }),
        ],
        trophyNotes: 'Joey gets togetherness trophy',
    }),
});

const upcoming = makeFilm({
    imdbID: 'tt0000102',
    title: 'Amélie',
    year: '2001',
    director: 'Jean-Pierre Jeunet',
    movieClubInfo: makeClubInfo({ selector: 'Gabe', watchDate: null, clubRatings: [] }),
});

const list: FilmListDefinition = {
    id: 'gabe-rain',
    name: 'Films With Rain',
    owner: 'Gabe',
    description: null,
    createdAt: '2026-08-15T23:43:02Z',
    entries: [{ rank: 1, imdbID: 'tt0000101', description: null }],
};

const logEntry: WatchedEntry = {
    imdbID: 'tt0000101',
    watchDate: '2026-10-02',
    score: 8,
    scoreQualifier: null,
    blurb: 'Rewatched it on a long flight.',
    image: null,
    posterImage: null,
    trailerKey: null,
    hideTrailer: false,
    updatedAt: '2026-10-02T03:54:56Z',
};

const sources: SearchSources = {
    films: [samurai, upcoming],
    members: [makeMember({ name: 'Gabe', title: 'Professor' }), makeMember({ name: 'Mark' })],
    lists: [list],
    watched: { Gabe: [logEntry] },
};

const docs = buildSearchIndex(sources);
const groupsFor = (query: string) => searchIndex(docs, query);
const titles = (query: string, group: string) =>
    groupsFor(query)
        .find((entry) => entry.key === group)
        ?.results.map((result) => result.title) ?? [];

describe('searchIndex', () => {
    it('finds nothing for an empty query', () => {
        expect(groupsFor('   ')).toEqual([]);
    });

    it('finds a film by the people who made it, and says so', () => {
        const [film] = groupsFor('mifune').find((group) => group.key === 'film')!.results;
        expect(film.title).toBe('Seven Samurai');
        expect(film.context).toEqual({ label: 'Starring', text: 'Toshiro Mifune' });
    });

    it('leaves out the reason when the meta line already gives it', () => {
        const [film] = groupsFor('kurosawa').find((group) => group.key === 'film')!.results;
        expect(film.meta).toContain('Dir. Akira Kurosawa');
        expect(film.context).toBeNull();
    });

    it("leads with a member when their name is the query, and brings along what's theirs", () => {
        const groups = groupsFor('gabe');
        expect(groups[0].key).toBe('member');
        expect(groups[0].results[0].meta).toEqual(['Professor', '1 pick', '1 logged']);
        expect(titles('gabe', 'list')).toEqual(['Films With Rain']);
        expect(titles('gabe', 'review')).toEqual(expect.arrayContaining(['Gabe on Seven Samurai']));
    });

    it("searches reviews' words, at the screening and in the logs", () => {
        expect(titles('rain battle', 'review')).toEqual(['Gabe on Seven Samurai']);
        const [logReview] = groupsFor('flight').find((group) => group.key === 'review')!.results;
        expect(logReview.href).toBe('/watched/Gabe#log-tt0000101');
        expect(logReview.quote).toBe('Rewatched it on a long flight.');
    });

    it('matches every word, ignoring case and accents', () => {
        expect(titles('AMELIE', 'film')).toEqual(['Amélie']);
        expect(titles('seven kurosawa', 'film')).toEqual(['Seven Samurai']);
        expect(titles('seven zzz', 'film')).toEqual([]);
    });

    it('only matches the start of a word for a query of a letter or two', () => {
        // "ai" is inside "Samurai" but starts nothing.
        expect(titles('ai', 'film')).toEqual([]);
        expect(titles('sa', 'film')).toEqual(['Seven Samurai']);
    });

    it('marks a film with no watch date as up next and gives a screening its average', () => {
        const [amelie] = groupsFor('amelie')[0].results;
        expect(amelie.badge).toBe('Up next');
        const [film] = groupsFor('seven samurai').find((group) => group.key === 'film')!.results;
        expect(film.score).toMatchObject({ value: '8.0', label: 'Club avg' });
    });

    it('finds trophies by award and recipient', () => {
        expect(titles('togetherness', 'trophy')).toHaveLength(1);
        expect(titles('joey', 'trophy')).toHaveLength(1);
    });

    it('finds the pages by name and by what is on them', () => {
        expect(titles('stats', 'page')).toEqual(['Almanac']);
    });
});

describe('searchSuggestions', () => {
    it('offers what is up next, recent screenings, and the pages', () => {
        const [screenings, pages] = searchSuggestions(docs);
        expect(screenings.results.map((result) => result.title)).toEqual([
            'Amélie',
            'Seven Samurai',
        ]);
        expect(pages.results.map((result) => result.title)).toContain('Log');
    });
});

describe('highlightRuns', () => {
    it('marks each word where it appears, accents and all', () => {
        expect(highlightRuns('Amélie in Paris', queryWords('amelie par'))).toEqual([
            { text: 'Amélie', match: true },
            { text: ' in ', match: false },
            { text: 'Par', match: true },
            { text: 'is', match: false },
        ]);
    });
});
