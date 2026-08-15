import {
    compareWatched,
    formatWatchDate,
    formatWatchedScore,
    getWatchedForMember,
    resolveWatchedEntries,
    resolveWatchedEntry,
    type WatchedDataSources,
} from './watchedUtils';
import type { WatchedEntry, WatchedLog } from '../types/watched';
import { makeFilm } from '../test-utils/factories';

const entry = (overrides: Partial<WatchedEntry> = {}): WatchedEntry => ({
    imdbID: 'tt1000000',
    watchDate: '2026-08-09',
    score: null,
    scoreQualifier: null,
    blurb: null,
    updatedAt: '2026-08-09T12:00:00Z',
    ...overrides,
});

const clubFilm = makeFilm({ imdbID: 'tt0107653', title: 'Naked', year: '1993', poster: 'club.jpg' });

const sources = (watched: WatchedLog): WatchedDataSources => ({
    watched,
    films: [clubFilm],
    summaries: {
        tt2000000: {
            imdbID: 'tt2000000',
            title: 'A Cached Film',
            year: '1985',
            poster: 'cached.jpg',
        },
    },
});

describe('getWatchedForMember', () => {
    const log: WatchedLog = {
        Jacob: [
            entry({ imdbID: 'tt1000001', watchDate: '2026-07-01' }),
            entry({ imdbID: 'tt1000002', watchDate: '2026-08-09' }),
        ],
    };

    it('returns the log newest watch first, whatever order it is stored in', () => {
        expect(getWatchedForMember('Jacob', sources(log)).map((e) => e.imdbID)).toEqual([
            'tt1000002',
            'tt1000001',
        ]);
    });

    it('matches the owner case-insensitively', () => {
        expect(getWatchedForMember('jacob', sources(log))).toHaveLength(2);
        expect(getWatchedForMember('  JACOB  ', sources(log))).toHaveLength(2);
    });

    it('is empty for a member with no log, and for no member at all', () => {
        expect(getWatchedForMember('Andy', sources(log))).toEqual([]);
        expect(getWatchedForMember(undefined, sources(log))).toEqual([]);
        expect(getWatchedForMember('   ', sources(log))).toEqual([]);
    });

    it('does not hand out the stored array to be mutated', () => {
        const result = getWatchedForMember('Jacob', sources(log));
        result.pop();
        expect(getWatchedForMember('Jacob', sources(log))).toHaveLength(2);
    });
});

describe('compareWatched', () => {
    it('breaks a same-day tie on id, so the order is total', () => {
        // Two films watched the same day must not swap places between renders.
        const a = entry({ imdbID: 'tt0000002', watchDate: '2026-08-09' });
        const b = entry({ imdbID: 'tt0000001', watchDate: '2026-08-09' });
        expect([a, b].sort(compareWatched).map((e) => e.imdbID)).toEqual([
            'tt0000001',
            'tt0000002',
        ]);
    });
});

describe('resolveWatchedEntry', () => {
    it('resolves a club film and exposes it as the crossover', () => {
        const resolved = resolveWatchedEntry(entry({ imdbID: 'tt0107653' }), sources({}));
        expect(resolved.title).toBe('Naked');
        expect(resolved.poster).toBe('club.jpg');
        expect(resolved.clubFilm).toBe(clubFilm);
    });

    it('keeps the member’s own score on a club film rather than the club’s', () => {
        // The whole point of allowing the overlap: these two ratings are
        // independent, and nothing here may read one for the other.
        const resolved = resolveWatchedEntry(
            entry({ imdbID: 'tt0107653', score: 8, blurb: 'Mine alone.' }),
            sources({})
        );
        expect(resolved.score).toBe(8);
        expect(resolved.blurb).toBe('Mine alone.');
    });

    it('falls back to the summary cache, with no club film attached', () => {
        const resolved = resolveWatchedEntry(entry({ imdbID: 'tt2000000' }), sources({}));
        expect(resolved.title).toBe('A Cached Film');
        expect(resolved.clubFilm).toBeUndefined();
    });

    it('degrades to a placeholder for an id nothing knows yet', () => {
        // A film logged a minute ago has not been through the CI enrichment step.
        const resolved = resolveWatchedEntry(entry({ imdbID: 'tt9999999' }), sources({}));
        expect(resolved).toMatchObject({ title: null, year: null, poster: null });
        expect(resolved.clubFilm).toBeUndefined();
    });
});

describe('resolveWatchedEntries', () => {
    it('resolves in watch order', () => {
        const resolved = resolveWatchedEntries(
            [
                entry({ imdbID: 'tt2000000', watchDate: '2026-01-01' }),
                entry({ imdbID: 'tt0107653', watchDate: '2026-06-01' }),
            ],
            sources({})
        );
        expect(resolved.map((e) => e.title)).toEqual(['Naked', 'A Cached Film']);
    });
});

describe('formatWatchDate', () => {
    it('formats in the local calendar, not UTC', () => {
        // `new Date('2026-08-09')` is UTC midnight, which renders as the 8th
        // anywhere west of Greenwich — wrong for every entry the club logs.
        expect(formatWatchDate('2026-08-09')).toBe('Aug 9, 2026');
    });

    it('passes anything unparseable straight through', () => {
        expect(formatWatchDate('sometime in 2026')).toBe('sometime in 2026');
    });
});

describe('formatWatchedScore', () => {
    it('renders the club’s qualifier convention and nothing for an unset score', () => {
        expect(formatWatchedScore({ score: 7.5, scoreQualifier: 'd' })).toBe('7.5d');
        expect(formatWatchedScore({ score: 8, scoreQualifier: null })).toBe('8');
        expect(formatWatchedScore({ score: null, scoreQualifier: null })).toBeNull();
    });
});
