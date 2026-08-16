import {
    clearPendingFilmSummaries,
    pendingFilmSummary,
    rememberFilmSummary,
} from './pendingFilmSummaries';
import { resolveListEntry } from './listUtils';
import { resolveWatchedEntry } from './watchedUtils';
import { filmData } from '../types/film';

const KEY = 'cc.pendingFilms';

const hit = {
    imdbID: 'tt9999991',
    title: 'A Film Added A Minute Ago',
    year: '2026',
    poster: 'https://example.com/poster.jpg',
};

beforeEach(() => {
    localStorage.clear();
    clearPendingFilmSummaries();
});

describe('rememberFilmSummary', () => {
    it('keeps what the search hit knew, and survives a reload', () => {
        rememberFilmSummary(hit);

        expect(pendingFilmSummary(hit.imdbID)).toEqual({
            imdbID: hit.imdbID,
            title: hit.title,
            year: hit.year,
            poster: hit.poster,
        });

        // What a reload sees: the module state is gone, the store is not.
        const stored = localStorage.getItem(KEY);
        expect(stored).not.toBeNull();
        expect(JSON.parse(stored as string)[hit.imdbID].summary.title).toBe(hit.title);
    });

    it('ignores a film the bundle already knows, whose record is the better one', () => {
        const bundled = filmData[0];
        rememberFilmSummary({ imdbID: bundled.imdbID, title: 'Stale', year: null, poster: null });
        expect(pendingFilmSummary(bundled.imdbID)).toBeUndefined();
    });

    it('ignores a titleless hit, which is what the row would fall back to anyway', () => {
        rememberFilmSummary({ ...hit, title: '   ' });
        expect(pendingFilmSummary(hit.imdbID)).toBeUndefined();
    });
});

describe('reading the store', () => {
    it('drops a record older than the fourteen-day cutoff', () => {
        const old = Date.now() - 15 * 24 * 60 * 60 * 1000;
        localStorage.setItem(KEY, JSON.stringify({ [hit.imdbID]: { summary: hit, savedAt: old } }));
        expect(pendingFilmSummary(hit.imdbID)).toBeUndefined();
    });

    it('keeps a record inside it', () => {
        const recent = Date.now() - 24 * 60 * 60 * 1000;
        localStorage.setItem(
            KEY,
            JSON.stringify({ [hit.imdbID]: { summary: hit, savedAt: recent } })
        );
        expect(pendingFilmSummary(hit.imdbID)?.title).toBe(hit.title);
    });

    it('survives junk in the store rather than throwing mid-render', () => {
        localStorage.setItem(KEY, 'not json');
        expect(pendingFilmSummary(hit.imdbID)).toBeUndefined();

        clearPendingFilmSummaries();
        localStorage.setItem(KEY, JSON.stringify({ [hit.imdbID]: { savedAt: Date.now() } }));
        expect(pendingFilmSummary(hit.imdbID)).toBeUndefined();
    });
});

describe('the resolvers', () => {
    it('titles a list entry the bundled cache has never heard of', () => {
        rememberFilmSummary(hit);

        const resolved = resolveListEntry({ rank: 1, imdbID: hit.imdbID, description: null });
        expect(resolved.title).toBe(hit.title);
        expect(resolved.year).toBe('2026');
        expect(resolved.poster).toBe(hit.poster);
    });

    it('titles a watch-log entry the same way', () => {
        rememberFilmSummary(hit);

        const resolved = resolveWatchedEntry({
            imdbID: hit.imdbID,
            watchDate: '2026-08-15',
            score: null,
            scoreQualifier: null,
            blurb: null,
            updatedAt: '2026-08-15T12:00:00Z',
        });
        expect(resolved.title).toBe(hit.title);
        expect(resolved.poster).toBe(hit.poster);
    });

    it('still prefers the enriched cache once CI has caught up', () => {
        rememberFilmSummary(hit);

        const resolved = resolveListEntry(
            { rank: 1, imdbID: hit.imdbID, description: null },
            {
                summaries: {
                    [hit.imdbID]: {
                        imdbID: hit.imdbID,
                        title: 'The Enriched Title',
                        year: '2026',
                        poster: 'enriched.jpg',
                    },
                },
            }
        );
        expect(resolved.title).toBe('The Enriched Title');
        expect(resolved.poster).toBe('enriched.jpg');
    });

    it("lets the member's own poster override win, as it does everywhere else", () => {
        rememberFilmSummary(hit);

        const resolved = resolveListEntry({
            rank: 1,
            imdbID: hit.imdbID,
            description: null,
            posterImage: 'mine.jpg',
        });
        expect(resolved.title).toBe(hit.title);
        expect(resolved.poster).toBe('mine.jpg');
    });
});
