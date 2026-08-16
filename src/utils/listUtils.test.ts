import { getListById, getListsForMember, resolveListEntries, resolveListEntry } from './listUtils';
import { FilmListDefinition, ListFilmSummary } from '../types/list';
import type { WatchedEntry } from '../types/watched';
import { makeClubInfo, makeFilm, makeRating } from '../test-utils/factories';

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

// --- Where a row's score comes from --------------------------------------
//
// The same list, against data where Andy has rated the club film with the club
// and logged the cached one on his own.

const scoredClubFilm = makeFilm({
    imdbID: 'tt0000001',
    title: 'A Club Film',
    year: '1999',
    movieClubInfo: makeClubInfo({
        clubRatings: [
            makeRating({ user: 'andy', score: 8 }),
            makeRating({ user: 'gabe', score: 2 }),
        ],
    }),
});

const logEntry = (imdbID: string, score: number | null): WatchedEntry => ({
    imdbID,
    watchDate: '2026-01-01',
    score,
    scoreQualifier: null,
    blurb: null,
    updatedAt: '2026-01-01T00:00:00Z',
});

const scoreSources = {
    lists: [andysList],
    films: [scoredClubFilm],
    summaries,
    watched: { Andy: [logEntry('tt0000002', 6.5)] },
};

const entryFor = (imdbID: string, score?: number | null) => ({
    rank: 1,
    imdbID,
    description: null,
    ...(score === undefined ? {} : { score }),
});

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

    it('shows the member’s own poster over the film’s, whichever source has it', () => {
        const own = { posterImage: 'https://example.com/mine.jpg' };

        // A club film's poster is displaced on the row and untouched in
        // films.json — this is the member's list, not a club record.
        const onClub = resolveListEntry({ ...andysList.entries[1], ...own }, sources);
        expect(onClub.poster).toBe('https://example.com/mine.jpg');
        expect(onClub.clubFilm).toBe(clubFilm);

        expect(resolveListEntry({ ...andysList.entries[0], ...own }, sources).poster).toBe(
            'https://example.com/mine.jpg'
        );

        // The one case where it is the row's only artwork: a film saved a
        // minute ago, which the CI enrichment step hasn't reached.
        expect(resolveListEntry({ ...andysList.entries[2], ...own }, sources).poster).toBe(
            'https://example.com/mine.jpg'
        );
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

    it('resolves scores against the list owner, not the caller', () => {
        // The club film is one Andy rated 8; the cached film is one he logged.
        const [first, second] = resolveListEntries(andysList, scoreSources);
        expect(first).toMatchObject({ score: 8, scoreSource: 'club' });
        expect(second).toMatchObject({ score: 6.5, scoreSource: 'log' });
    });
});

describe('resolveListEntry scores', () => {
    it("uses the entry's own score ahead of anything else", () => {
        expect(resolveListEntry(entryFor('tt0000001', 3), scoreSources, 'Andy')).toMatchObject({
            score: 3,
            scoreSource: 'entry',
        });
    });

    it('falls back to the owner’s watch log', () => {
        expect(resolveListEntry(entryFor('tt0000002'), scoreSources, 'Andy')).toMatchObject({
            score: 6.5,
            scoreSource: 'log',
        });
    });

    it('falls back to the owner’s club rating, and only theirs', () => {
        expect(resolveListEntry(entryFor('tt0000001'), scoreSources, 'andy')).toMatchObject({
            score: 8,
            scoreSource: 'club',
        });
        expect(resolveListEntry(entryFor('tt0000001'), scoreSources, 'Joey')).toMatchObject({
            score: null,
            scoreSource: null,
        });
    });

    it('prefers the log to the club rating for a film in both', () => {
        const alsoLogged = { ...scoreSources, watched: { Andy: [logEntry('tt0000001', 4)] } };
        expect(resolveListEntry(entryFor('tt0000001'), alsoLogged, 'Andy')).toMatchObject({
            score: 4,
            scoreSource: 'log',
        });
    });

    it('treats a scoreless log entry as no score at all, and keeps looking', () => {
        const unscoredLog = { ...scoreSources, watched: { Andy: [logEntry('tt0000001', null)] } };
        expect(resolveListEntry(entryFor('tt0000001'), unscoredLog, 'Andy')).toMatchObject({
            score: 8,
            scoreSource: 'club',
        });
    });

    it('has no score with no owner to resolve one against', () => {
        expect(resolveListEntry(entryFor('tt0000001'), scoreSources)).toMatchObject({
            score: null,
            scoreSource: null,
        });
    });

    it('keeps a zero, which is a score like any other', () => {
        expect(resolveListEntry(entryFor('tt0000001', 0), scoreSources, 'Andy')).toMatchObject({
            score: 0,
            scoreSource: 'entry',
        });
    });
});

// --- Which trailer a row plays -------------------------------------------

describe('resolveListEntry trailers', () => {
    const trailerSources = {
        films: [makeFilm({ imdbID: 'tt0000001', title: 'A Club Film', trailerKey: 'CLUBTRAILER' })],
        summaries: {
            tt0000002: { ...summaries.tt0000002, trailerKey: 'CACHETRAILER' },
        },
    };

    const entryFor = (imdbID: string, overrides = {}) => ({
        rank: 1,
        imdbID,
        description: null,
        ...overrides,
    });

    it("plays the film's own trailer, from whichever source knew it", () => {
        expect(resolveListEntry(entryFor('tt0000001'), trailerSources).resolvedTrailerKey).toBe(
            'CLUBTRAILER'
        );
        expect(resolveListEntry(entryFor('tt0000002'), trailerSources).resolvedTrailerKey).toBe(
            'CACHETRAILER'
        );
    });

    it("plays the member's own link over it", () => {
        const entry = entryFor('tt0000001', { trailerKey: 'dQw4w9WgXcQ' });
        expect(resolveListEntry(entry, trailerSources).resolvedTrailerKey).toBe('dQw4w9WgXcQ');
    });

    it('plays nothing when the member hid it', () => {
        const hidden = entryFor('tt0000001', { trailerKey: 'dQw4w9WgXcQ', hideTrailer: true });
        expect(resolveListEntry(hidden, trailerSources).resolvedTrailerKey).toBeNull();
    });

    it('is the row’s only trailer when nothing knows the film yet', () => {
        // A film added a minute ago: no club record, no summary, and therefore
        // no trailer but the one the member pasted.
        const pending = entryFor('tt0000003', { trailerKey: 'dQw4w9WgXcQ' });
        expect(resolveListEntry(pending, trailerSources).resolvedTrailerKey).toBe('dQw4w9WgXcQ');
        expect(
            resolveListEntry(entryFor('tt0000003'), trailerSources).resolvedTrailerKey
        ).toBeNull();
    });
});
