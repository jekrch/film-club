/**
 * Covers `request`, the single function every editing surface funnels through.
 *
 * Its branches were the least-covered code in the app (5%) despite every save,
 * delete, and editor read in the site depending on them. What matters here is
 * not the happy path but the four ways a call can fail — worker error,
 * non-JSON response, transport failure, and deliberate abort — because each
 * one surfaces to a member differently and only one of them is a real fault.
 */

// The global stub in `jest.config.js` reports an unconfigured build, which
// would short-circuit every call before it reached fetch. These tests are
// about what happens *after* that check, so they mock a configured worker.
jest.mock('../config/editorEnv', () => ({
    EDITOR_API_URL: 'https://worker.test',
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
}));

import {
    ClubApiError,
    NEW_LIST_ID,
    deleteWatched,
    getClub,
    getLists,
    getSession,
    getWatched,
    isEditorConfigured,
    putList,
    putRating,
    searchFilms,
} from './clubApi';

const TOKEN = 'id-token';

/** Marks a body that fails to parse, standing in for a Cloudflare HTML error page. */
const NOT_JSON = Symbol('not json');

const respond = (status: number, body: unknown): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () =>
            body === NOT_JSON
                ? Promise.reject(new SyntaxError('Unexpected token <'))
                : Promise.resolve(body),
    }) as unknown as Response;

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
});

/** The options object handed to the most recent `fetch` call. */
const lastInit = (): RequestInit => mockFetch.mock.calls[0][1] as RequestInit;

describe('request — outgoing shape', () => {
    it('carries the bearer token on a read and sends no body', async () => {
        mockFetch.mockResolvedValue(respond(200, { member: 'Andy', admin: false }));

        await expect(getSession(TOKEN)).resolves.toEqual({ member: 'Andy', admin: false });

        expect(mockFetch).toHaveBeenCalledWith(
            'https://worker.test/api/session',
            expect.anything()
        );
        const init = lastInit();
        expect(init.method).toBe('GET');
        expect(init.body).toBeUndefined();
        expect(init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    });

    // Content-Type is set only alongside a body. A GET that announced JSON it
    // wasn't sending would trip the worker's CORS preflight for no reason.
    it('declares JSON only when there is a body to declare', async () => {
        mockFetch.mockResolvedValue(respond(200, { member: 'Andy', admin: false }));
        await getSession(TOKEN);
        expect(lastInit().headers).not.toHaveProperty('Content-Type');

        mockFetch.mockReset();
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'tt1', rating: {}, changed: true }));
        await putRating(TOKEN, 'tt1', { score: 8 });

        const init = lastInit();
        expect(init.method).toBe('PUT');
        expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
        expect(JSON.parse(init.body as string)).toEqual({ score: 8 });
    });

    // A `null` in a patch means "deliberately blank" and must survive
    // serialisation — dropping it would silently turn a clear into a no-op.
    it('preserves an explicit null in a patch rather than dropping it', async () => {
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'tt1', rating: {}, changed: true }));
        await putRating(TOKEN, 'tt1', { score: null, blurb: null });
        expect(JSON.parse(lastInit().body as string)).toEqual({ score: null, blurb: null });
    });

    it('percent-encodes ids so a stray character cannot reshape the path', async () => {
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'x', rating: {}, changed: false }));
        await putRating(TOKEN, 'tt1/../admin', {});
        expect(mockFetch.mock.calls[0][0]).toBe(
            'https://worker.test/api/films/tt1%2F..%2Fadmin/rating'
        );
    });

    it('encodes a search query, including spaces and ampersands', async () => {
        mockFetch.mockResolvedValue(respond(200, { results: [] }));
        await searchFilms(TOKEN, 'tokyo story & more');
        expect(mockFetch.mock.calls[0][0]).toBe(
            'https://worker.test/api/films/search?q=tokyo%20story%20%26%20more'
        );
    });

    // `owner` is an admin acting on someone else's log. Absent, the worker uses
    // the caller — so an empty query string and a missing one must differ.
    it('appends the owner query only when one is given', async () => {
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'tt1', owner: 'a', deleted: true }));
        await deleteWatched(TOKEN, 'tt1');
        expect(mockFetch.mock.calls[0][0]).toBe('https://worker.test/api/watched/tt1');

        mockFetch.mockReset();
        mockFetch.mockResolvedValue(respond(200, { imdbID: 'tt1', owner: 'b', deleted: true }));
        await deleteWatched(TOKEN, 'tt1', 'Andy B');
        expect(mockFetch.mock.calls[0][0]).toBe(
            'https://worker.test/api/watched/tt1?owner=Andy%20B'
        );
    });

    it('sends a create against the documented placeholder id', async () => {
        mockFetch.mockResolvedValue(respond(200, { list: { id: 'real-id' }, created: true }));
        await putList(TOKEN, NEW_LIST_ID, { name: 'Noir', description: null, entries: [] });
        expect(mockFetch.mock.calls[0][0]).toBe('https://worker.test/api/lists/new');
    });
});

describe('request — failure handling', () => {
    // The worker writes its errors for a member to read, so the message must
    // reach the UI intact rather than being replaced by a generic one.
    it("surfaces the worker's own message and status", async () => {
        mockFetch.mockResolvedValue(respond(403, { error: "That's Andy's list" }));

        const error = await getLists(TOKEN).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ClubApiError);
        expect(error).toMatchObject({ status: 403, message: "That's Andy's list" });
    });

    // 401 is the one status callers branch on, to send the member back through
    // sign-in rather than showing a failure.
    it('keeps a 401 distinguishable for the caller', async () => {
        mockFetch.mockResolvedValue(respond(401, { error: 'Token expired' }));
        await expect(getSession(TOKEN)).rejects.toMatchObject({ status: 401 });
    });

    // A 522 or a WAF block answers with HTML, not the JSON the worker promises.
    it('falls back to a generic message when the body will not parse', async () => {
        mockFetch.mockResolvedValue(respond(522, NOT_JSON));

        const error = await getLists(TOKEN).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ClubApiError);
        expect(error).toMatchObject({ status: 522, message: 'Request failed (522).' });
    });

    it('falls back when the JSON body carries no error field', async () => {
        mockFetch.mockResolvedValue(respond(500, { unexpected: true }));
        await expect(getLists(TOKEN)).rejects.toMatchObject({
            status: 500,
            message: 'Request failed (500).',
        });
    });

    // Offline, DNS failure, worker down: no status exists, so 0 stands for
    // "never reached the server" and the message says so.
    it('reports a transport failure as status 0', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        const error = await getSession(TOKEN).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ClubApiError);
        expect(error).toMatchObject({ status: 0 });
        expect((error as ClubApiError).message).toContain("Couldn't reach the server");
    });

    // A cancelled search is not a failure. Callers test `error.name`, so the
    // abort must arrive as itself and never wrapped in a ClubApiError.
    it('rethrows an abort untouched instead of wrapping it', async () => {
        mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

        const error = await searchFilms(TOKEN, 'tokyo').catch((e: unknown) => e);

        expect(error).not.toBeInstanceOf(ClubApiError);
        expect((error as DOMException).name).toBe('AbortError');
    });

    it('passes an abort signal through to fetch', async () => {
        const controller = new AbortController();
        mockFetch.mockResolvedValue(respond(200, { results: [] }));
        await searchFilms(TOKEN, 'q', controller.signal);
        expect(lastInit().signal).toBe(controller.signal);
    });
});

// Each read endpoint returns its payload under a named key. Unwrapping is the
// only logic in these wrappers, and getting it wrong yields `undefined` rather
// than an error — a silent empty page.
describe('read wrappers unwrap their payload key', () => {
    it('getLists returns the lists array', async () => {
        mockFetch.mockResolvedValue(respond(200, { lists: [{ id: 'a' }, { id: 'b' }] }));
        await expect(getLists(TOKEN)).resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('getWatched returns the log', async () => {
        mockFetch.mockResolvedValue(respond(200, { watched: { andy: [] } }));
        await expect(getWatched(TOKEN)).resolves.toEqual({ andy: [] });
    });

    it('getClub returns the member array', async () => {
        mockFetch.mockResolvedValue(respond(200, { club: [{ name: 'Andy' }] }));
        await expect(getClub(TOKEN)).resolves.toEqual([{ name: 'Andy' }]);
    });

    it('searchFilms returns the results array', async () => {
        const hit = { imdbID: 'tt1', title: 'Tokyo Story', year: '1953', poster: null };
        mockFetch.mockResolvedValue(respond(200, { results: [hit] }));
        await expect(searchFilms(TOKEN, 'tokyo')).resolves.toEqual([hit]);
    });
});

describe('isEditorConfigured', () => {
    it('is true when both build values are present', () => {
        expect(isEditorConfigured()).toBe(true);
    });

    // A fork or a local checkout without the env vars is a supported way to run
    // the site: editing must refuse locally rather than fire a doomed request.
    it('refuses to call out at all when the build has no worker', async () => {
        jest.resetModules();
        jest.doMock('../config/editorEnv', () => ({
            EDITOR_API_URL: '',
            GOOGLE_CLIENT_ID: '',
        }));

        const api = await import('./clubApi');

        expect(api.isEditorConfigured()).toBe(false);
        await expect(api.getSession(TOKEN)).rejects.toMatchObject({
            status: 0,
            message: 'Editing is not configured for this build.',
        });
        expect(mockFetch).not.toHaveBeenCalled();

        jest.dontMock('../config/editorEnv');
        jest.resetModules();
    });
});
