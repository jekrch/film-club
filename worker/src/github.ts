/**
 * GitHub-as-database: read a JSON file from `main`, mutate it, commit it back.
 *
 * Ported from `comic-snaps/worker/src/github.ts`, narrowed to the files this
 * worker owns. The invariant that makes this safe is §8.1's **one writer per
 * file**: CI owns `films.json` and `listFilms.json`, the worker owns
 * `overrides.json`, `lists.json`, and `watched.json`, and nothing writes both
 * sides. There is no merge to get wrong — only the sha to respect.
 *
 * Paths are constants in this module. The worker never derives a path from
 * request input; that is the rule that keeps a stolen token's blast radius to
 * the two files below rather than the whole repo.
 */

import { HttpError } from './errors';
import type { Env } from './types';

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'film-club-editor';
const BRANCH = 'main';

/** The only three paths this worker will ever write. */
export const LISTS_PATH = 'src/assets/lists.json';
export const OVERRIDES_PATH = 'src/assets/overrides.json';
export const WATCHED_PATH = 'src/assets/watched.json';
/** Read-only: used to reject a rating write for a film the sheet doesn't know. */
export const FILMS_PATH = 'src/assets/films.json';

interface ContentsResponse {
    content: string;
    sha: string;
}

function headers(env: Env, accept = 'application/vnd.github+json'): Record<string, string> {
    return {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Accept: accept,
    };
}

// btoa/atob only handle Latin-1, so non-ASCII (curly quotes, em-dashes, accents)
// has to round-trip through UTF-8 bytes. Member-written blurbs are full of it.
function utf8ToBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToUtf8(base64: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function contentsUrl(env: Env, path: string): string {
    const [owner, repo] = env.GITHUB_REPO.split('/');
    return `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
}

/**
 * Maps a GitHub failure to something the browser can act on.
 *
 * The PAT expires (a year at most) and will otherwise break saves with a
 * generic error a year from now, when nobody remembers this exists — so a 401
 * from GitHub is reported as exactly that rather than as "save failed".
 */
function githubError(path: string, status: number, body: string): HttpError {
    if (status === 401 || status === 403) {
        return new HttpError(
            502,
            `GitHub rejected the worker's credentials (${status}). The GITHUB_TOKEN secret is probably expired or under-scoped.`
        );
    }
    return new HttpError(502, `GitHub request for ${path} failed (${status}): ${body.slice(0, 200)}`);
}

/** Reads a JSON file from `main`. A missing file is `{ data: null }`, not an error. */
export async function readJson<T>(
    env: Env,
    path: string
): Promise<{ data: T | null; sha: string | null }> {
    const resp = await fetch(contentsUrl(env, path), { headers: headers(env) });

    if (resp.status === 404) return { data: null, sha: null };
    if (!resp.ok) throw githubError(path, resp.status, await resp.text());

    const meta = (await resp.json()) as ContentsResponse;
    return { data: JSON.parse(base64ToUtf8(meta.content.replace(/\n/g, ''))) as T, sha: meta.sha };
}

/** Commit author, so `git log` credits the member without publishing their email. */
export interface CommitAuthor {
    name: string;
    email: string;
}

async function writeJson(
    env: Env,
    path: string,
    data: unknown,
    sha: string | null,
    message: string,
    author: CommitAuthor
): Promise<boolean> {
    // Trailing newline so the file matches what Prettier and the Python scripts
    // write; without it every worker commit shows a "\ No newline" diff.
    const content = `${JSON.stringify(data, null, 2)}\n`;

    const body: Record<string, unknown> = {
        message,
        content: utf8ToBase64(content),
        branch: BRANCH,
        author,
    };
    if (sha) body.sha = sha;

    const resp = await fetch(contentsUrl(env, path), {
        method: 'PUT',
        headers: headers(env),
        body: JSON.stringify(body),
    });

    if (resp.ok) return true;
    // 409 (and 422 for a stale sha) means someone committed in between: the
    // twice-daily sheet sync, a deploy's derived-data commit, or another member.
    if (resp.status === 409 || resp.status === 422) return false;
    throw githubError(path, resp.status, await resp.text());
}

/**
 * What a mutation decided to do. `commit: false` is a legitimate outcome — an
 * edit that changed nothing shouldn't produce a commit, because every commit to
 * `main` costs a full Pages build.
 */
export type CommitPlan<T, R> =
    | { commit: true; next: T; message: string; result: R }
    | { commit: false; result: R };

/**
 * Read → mutate → commit, retried once if the file moved underneath us.
 *
 * The sha is the concurrency control. One retry, not a loop: GitHub applies
 * secondary rate limits to bursty content writes, and a second conflict on a
 * six-person club means something is genuinely wrong rather than merely busy.
 * The mutation runs again on freshly-read data, so the retry can't resurrect
 * the stale copy.
 *
 * `apply` may throw an {@link HttpError} — that is how "no such list" and "not
 * yours" are reported, since both are only knowable once the file is in hand.
 */
export async function commitJson<T, R>(
    env: Env,
    path: string,
    fallback: T,
    author: CommitAuthor,
    apply: (current: T) => CommitPlan<T, R>
): Promise<R> {
    for (let attempt = 0; attempt < 2; attempt++) {
        const { data, sha } = await readJson<T>(env, path);
        const plan = apply(data ?? fallback);
        if (!plan.commit) return plan.result;

        if (await writeJson(env, path, plan.next, sha, plan.message, author)) {
            return plan.result;
        }
        // Brief backoff before re-reading; the conflicting write has landed by
        // the time GitHub returns the 409, so this is politeness, not a wait.
        await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new HttpError(
        409,
        `${path} kept changing underneath the save. Nothing was written — try again.`
    );
}

/**
 * The set of IMDb ids the club has actually watched.
 *
 * A rating write must name a film that already exists in `films.json`: the
 * worker cannot create films, that stays the sheet's job (§8.3). Fetched with
 * the raw media type because `films.json` is over half a megabyte and the
 * base64 `content` field caps out at 1 MB.
 *
 * Cached per isolate for a minute. Films only ever arrive by sheet sync, so the
 * cost of being a minute stale is that a film added *right now* can't be rated
 * for another minute — against re-downloading 500 KB on every save.
 */
const FILM_ID_TTL_MS = 60_000;
let filmIdCache: { ids: Set<string>; fetchedAt: number } | null = null;

export async function fetchClubFilmIds(env: Env): Promise<Set<string>> {
    if (filmIdCache && Date.now() - filmIdCache.fetchedAt < FILM_ID_TTL_MS) {
        return filmIdCache.ids;
    }

    const resp = await fetch(contentsUrl(env, FILMS_PATH), {
        headers: headers(env, 'application/vnd.github.raw'),
    });
    if (!resp.ok) throw githubError(FILMS_PATH, resp.status, await resp.text());

    const films = (await resp.json()) as Array<{ imdbID?: string }>;
    const ids = new Set<string>();
    for (const film of films) {
        if (typeof film?.imdbID === 'string') ids.add(film.imdbID);
    }

    filmIdCache = { ids, fetchedAt: Date.now() };
    return ids;
}
