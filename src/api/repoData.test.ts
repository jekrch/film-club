/**
 * Covers the four reads that moved off the worker and onto
 * `raw.githubusercontent.com`.
 *
 * Two things are worth pinning down. The URLs, because a wrong one fails as an
 * empty editor rather than an error — the callers all swallow a failed refresh
 * on purpose, since the bundle is already on screen. And the overlay, because
 * it is the entire reason this is safe to do at all: raw serves a file up to
 * five minutes old, and without the overlay a member who saved would be shown
 * the value they replaced.
 */

import { fetchClub, fetchLists, fetchOverrides, fetchWatched } from './repoData';
import { recordWrite, writeKeys } from './writeCache';
import type { FilmOverride, RatingOverride } from './clubApi';
import type { FilmListDefinition } from '../types/list';
import type { TeamMember } from '../types/team';
import type { WatchedEntry } from '../types/watched';

const RAW = 'https://raw.githubusercontent.com/jekrch/film-club/main/src/assets';

const respond = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as unknown as Response;

const mockFetch = jest.fn();

beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
});

const override = (score: number): RatingOverride => ({
    score,
    updatedBy: 'Andy',
    updatedAt: '2026-08-16T12:00:00Z',
});

const entry = (imdbID: string, watchDate: string): WatchedEntry => ({
    imdbID,
    watchDate,
    score: null,
    scoreQualifier: null,
    blurb: null,
    updatedAt: '2026-08-16T12:00:00Z',
});

describe('request shape', () => {
    it('reads each file from the repo, unauthenticated', async () => {
        mockFetch.mockResolvedValue(respond(200, { films: {} }));
        await fetchOverrides();

        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(`${RAW}/overrides.json`);
        // No Authorization header: the point of the move is that this costs
        // nothing and needs no token.
        expect(init.headers).toBeUndefined();
    });

    /**
     * Raw sets `max-age=300`. Nothing the browser sends bypasses GitHub's edge,
     * but this at least stops it answering from a copy older than the edge's.
     */
    it('revalidates rather than reading the browser cache', async () => {
        mockFetch.mockResolvedValue(respond(200, []));
        await fetchLists();

        expect((mockFetch.mock.calls[0][1] as RequestInit).cache).toBe('no-cache');
    });

    it('reports a failed fetch in words a member could read', async () => {
        mockFetch.mockResolvedValue(respond(404, null));
        await expect(fetchLists()).rejects.toThrow(/lists\.json/);
    });

    it('rethrows an abort untouched, since a cancelled read is not a failure', async () => {
        mockFetch.mockRejectedValue(new DOMException('aborted', 'AbortError'));
        await expect(fetchClub()).rejects.toMatchObject({ name: 'AbortError' });
    });
});

describe('fetchOverrides', () => {
    it('overlays a save the file has not caught up with', async () => {
        mockFetch.mockResolvedValue(
            respond(200, { films: { tt1: { ratings: { andy: override(7) } } } })
        );
        recordWrite('rating', writeKeys.rating('tt1', 'Andy'), override(9));

        const { films } = await fetchOverrides();

        expect(films.tt1.ratings.andy.score).toBe(9);
    });

    it('adds a rating for a film the file does not mention yet', async () => {
        mockFetch.mockResolvedValue(respond(200, { films: {} }));
        recordWrite('rating', writeKeys.rating('tt2', 'Andy'), override(6));

        const { films } = await fetchOverrides();

        expect(films.tt2.ratings.andy.score).toBe(6);
    });

    it('hides a reverted rating the file still carries', async () => {
        mockFetch.mockResolvedValue(
            respond(200, { films: { tt1: { ratings: { andy: override(7) } } } })
        );
        recordWrite('rating', writeKeys.rating('tt1', 'Andy'), null);

        const { films } = await fetchOverrides();

        expect(films.tt1.ratings.andy).toBeUndefined();
    });

    it('leaves another member on the same film alone', async () => {
        mockFetch.mockResolvedValue(
            respond(200, { films: { tt1: { ratings: { andy: override(7), mark: override(4) } } } })
        );
        recordWrite('rating', writeKeys.rating('tt1', 'Andy'), override(9));

        const { films } = await fetchOverrides();

        expect(films.tt1.ratings.mark.score).toBe(4);
    });

    /**
     * A film's own record is a second, independent overlay on the same file.
     * The two must not stand on each other: an admin entering scores and a
     * member fixing the cover are separate saves against the same key.
     */
    describe('the film record beside the ratings', () => {
        const filmOverride = (backdropImage: string): FilmOverride => ({
            backdropImage,
            updatedBy: 'Jacob',
            updatedAt: '2026-08-16T12:00:00Z',
        });

        it('overlays a film save the file has not caught up with', async () => {
            mockFetch.mockResolvedValue(
                respond(200, { films: { tt1: { ratings: {}, film: filmOverride('old.jpg') } } })
            );
            recordWrite('film', writeKeys.film('tt1'), { film: filmOverride('new.jpg') });

            const { films } = await fetchOverrides();

            expect(films.tt1.film?.backdropImage).toBe('new.jpg');
        });

        it('keeps a rating the film write knew nothing about', async () => {
            mockFetch.mockResolvedValue(
                respond(200, { films: { tt1: { ratings: { andy: override(7) } } } })
            );
            recordWrite('film', writeKeys.film('tt1'), { film: filmOverride('new.jpg') });

            const { films } = await fetchOverrides();

            expect(films.tt1.ratings.andy.score).toBe(7);
            expect(films.tt1.film?.backdropImage).toBe('new.jpg');
        });

        it('shows a film added a moment ago and absent from the file', async () => {
            mockFetch.mockResolvedValue(respond(200, { films: {} }));
            recordWrite('film', writeKeys.film('tt9'), {
                film: filmOverride('hero.jpg'),
                added: { addedBy: 'Jacob', addedAt: 'x', title: 'Suspiria', year: '1977' },
            });

            const { films } = await fetchOverrides();

            expect(films.tt9.added?.addedBy).toBe('Jacob');
            // Always present, even on a film nobody has scored yet, so every
            // reader can index it without a guard.
            expect(films.tt9.ratings).toEqual({});
        });

        it('hides a withdrawn film the file still carries', async () => {
            mockFetch.mockResolvedValue(
                respond(200, {
                    films: { tt1: { ratings: {}, film: filmOverride('old.jpg'), added: {} } },
                })
            );
            recordWrite('film', writeKeys.film('tt1'), null);

            const { films } = await fetchOverrides();

            expect(films.tt1.film).toBeUndefined();
            expect(films.tt1.added).toBeUndefined();
        });

        it('forgets the overlay once the file agrees', async () => {
            const stored = filmOverride('new.jpg');
            mockFetch.mockResolvedValue(
                respond(200, { films: { tt1: { ratings: {}, film: stored } } })
            );
            recordWrite('film', writeKeys.film('tt1'), { film: stored });

            await fetchOverrides();

            expect(sessionStorage.getItem('cc.editor.writes') ?? '').not.toContain('tt1');
        });
    });

    /** Once the deploy lands, the overlay has to stop applying itself. */
    it('forgets the overlay once the file agrees', async () => {
        mockFetch.mockResolvedValue(
            respond(200, { films: { tt1: { ratings: { andy: override(9) } } } })
        );
        recordWrite('rating', writeKeys.rating('tt1', 'Andy'), override(9));

        await fetchOverrides();

        expect(sessionStorage.getItem('cc.editor.writes')).not.toContain('tt1');
    });
});

describe('fetchLists', () => {
    const list = (id: string, name: string): FilmListDefinition =>
        ({
            id,
            name,
            owner: 'Andy',
            description: null,
            ranked: true,
            entries: [],
        }) as FilmListDefinition;

    /**
     * The case behind the original complaint: a list saved a minute ago is not
     * stale in the file, it is absent from it — and the editor's "not found"
     * branch would otherwise be reached for a list that demonstrably exists.
     */
    it('supplies a list the file does not have yet', async () => {
        mockFetch.mockResolvedValue(respond(200, []));
        recordWrite('list', writeKeys.list('andy-horror'), list('andy-horror', 'Horror'));

        await expect(fetchLists()).resolves.toEqual([
            expect.objectContaining({ id: 'andy-horror' }),
        ]);
    });

    it('replaces a stale copy in place', async () => {
        mockFetch.mockResolvedValue(respond(200, [list('andy-horror', 'Old name')]));
        recordWrite('list', writeKeys.list('andy-horror'), list('andy-horror', 'New name'));

        const lists = await fetchLists();

        expect(lists).toHaveLength(1);
        expect(lists[0].name).toBe('New name');
    });

    it('removes a deleted list the file still carries', async () => {
        mockFetch.mockResolvedValue(respond(200, [list('andy-horror', 'Horror')]));
        recordWrite('list', writeKeys.list('andy-horror'), null);

        await expect(fetchLists()).resolves.toEqual([]);
    });
});

describe('fetchWatched', () => {
    it('overlays an entry onto the owner the file already knows', async () => {
        mockFetch.mockResolvedValue(respond(200, { Andy: [entry('tt1', '2026-01-01')] }));
        recordWrite('watched', writeKeys.watched('Andy', 'tt1'), entry('tt1', '2026-08-16'));

        const log = await fetchWatched();

        expect(log.Andy).toHaveLength(1);
        expect(log.Andy[0].watchDate).toBe('2026-08-16');
    });

    /**
     * The file keys by display name and the cache by the lowercased one, which
     * is all a caller reliably has — so the match has to be case-insensitive or
     * a save would land under a second, duplicate owner key.
     */
    it('matches the owner regardless of case rather than adding a key', async () => {
        mockFetch.mockResolvedValue(respond(200, { Andy: [entry('tt1', '2026-01-01')] }));
        recordWrite('watched', writeKeys.watched('ANDY', 'tt2'), entry('tt2', '2026-08-16'));

        const log = await fetchWatched();

        expect(Object.keys(log)).toEqual(['Andy']);
        expect(log.Andy).toHaveLength(2);
    });

    it('keeps the log newest-first after an overlay', async () => {
        mockFetch.mockResolvedValue(respond(200, { Andy: [entry('tt1', '2026-01-01')] }));
        recordWrite('watched', writeKeys.watched('Andy', 'tt2'), entry('tt2', '2026-08-16'));

        const log = await fetchWatched();

        expect(log.Andy.map((row) => row.imdbID)).toEqual(['tt2', 'tt1']);
    });

    it('removes an entry the file still carries', async () => {
        mockFetch.mockResolvedValue(respond(200, { Andy: [entry('tt1', '2026-01-01')] }));
        recordWrite('watched', writeKeys.watched('Andy', 'tt1'), null);

        await expect(fetchWatched()).resolves.toEqual({ Andy: [] });
    });
});

describe('fetchClub', () => {
    const member = (name: string, bio: string) => ({ name, bio }) as TeamMember;

    it('overlays a profile the file has not caught up with', async () => {
        mockFetch.mockResolvedValue(respond(200, [member('Andy', 'old')]));
        recordWrite('profile', writeKeys.profile('Andy'), member('Andy', 'new'));

        const club = await fetchClub();

        expect(club[0].bio).toBe('new');
    });

    /** The worker cannot create a member, so an unknown key is stale, not a row. */
    it('does not invent a member the roster has never had', async () => {
        mockFetch.mockResolvedValue(respond(200, [member('Andy', 'old')]));
        recordWrite('profile', writeKeys.profile('Nobody'), member('Nobody', 'x'));

        await expect(fetchClub()).resolves.toHaveLength(1);
    });
});
