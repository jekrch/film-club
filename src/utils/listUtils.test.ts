import { getListById, getListsForMember, resolveListEntries, resolveListEntry } from './listUtils';
import { FilmListDefinition, ListFilmSummary } from '../types/list';
import { makeFilm } from '../test-utils/factories';

const clubFilm = makeFilm({ imdbID: 'tt0000001', title: 'A Club Film', year: '1999' });

const summaries: Record<string, ListFilmSummary> = {
    tt0000002: {
        imdbID: 'tt0000002',
        title: 'A Cached Film',
        year: '1985',
        poster: 'https://example.com/cached.jpg',
    },
};

const andysList: FilmListDefinition = {
    id: 'andy-top-horror',
    name: 'Top Horror',
    owner: 'Andy',
    description: 'The ones that got to me.',
    entries: [
        { rank: 2, imdbID: 'tt0000002', description: null },
        { rank: 1, imdbID: 'tt0000001', description: 'Still the high-water mark.' },
        { rank: 3, imdbID: 'tt0000003', description: null },
    ],
};

const gabesList: FilmListDefinition = {
    id: 'gabe-comfort-watches',
    name: 'Comfort Watches',
    owner: 'Gabe',
    description: null,
    entries: [],
};

const sources = { lists: [andysList, gabesList], films: [clubFilm], summaries };

describe('getListsForMember', () => {
    it('matches an owner case-insensitively', () => {
        expect(getListsForMember('andy', sources).map((l) => l.id)).toEqual(['andy-top-horror']);
        expect(getListsForMember('ANDY', sources).map((l) => l.id)).toEqual(['andy-top-horror']);
    });

    it('returns an empty array for a member with no lists, or no name at all', () => {
        expect(getListsForMember('Joey', sources)).toEqual([]);
        expect(getListsForMember(undefined, sources)).toEqual([]);
        expect(getListsForMember('   ', sources)).toEqual([]);
    });

    it('reads the bundled lists when given no override', () => {
        expect(Array.isArray(getListsForMember('Andy'))).toBe(true);
    });
});

describe('getListById', () => {
    it('finds a list by its slug', () => {
        expect(getListById('gabe-comfort-watches', sources)?.name).toBe('Comfort Watches');
    });

    it('returns undefined for an unknown or missing id', () => {
        expect(getListById('nope', sources)).toBeUndefined();
        expect(getListById(undefined, sources)).toBeUndefined();
    });
});

describe('resolveListEntry', () => {
    it('prefers the club film, exposing it for linking', () => {
        const resolved = resolveListEntry(andysList.entries[1], sources);
        expect(resolved.title).toBe('A Club Film');
        expect(resolved.year).toBe('1999');
        expect(resolved.clubFilm).toBe(clubFilm);
        expect(resolved.description).toBe('Still the high-water mark.');
    });

    it('falls back to the summary cache, with no club film', () => {
        const resolved = resolveListEntry(andysList.entries[0], sources);
        expect(resolved.title).toBe('A Cached Film');
        expect(resolved.poster).toBe('https://example.com/cached.jpg');
        expect(resolved.clubFilm).toBeUndefined();
    });

    it('degrades to a placeholder when neither source knows the id', () => {
        const resolved = resolveListEntry(andysList.entries[2], sources);
        expect(resolved.imdbID).toBe('tt0000003');
        expect(resolved.rank).toBe(3);
        expect(resolved.title).toBeNull();
        expect(resolved.poster).toBeNull();
        expect(resolved.clubFilm).toBeUndefined();
    });
});

describe('resolveListEntries', () => {
    it('returns entries in rank order regardless of stored order', () => {
        expect(resolveListEntries(andysList, sources).map((e) => e.rank)).toEqual([1, 2, 3]);
    });
});
