/**
 * The data files the site fetches at runtime rather than bundles, generated
 * from `src/assets`.
 *
 * Two callers, one source of truth:
 *
 * - `liveData` in `vite.config.ts` emits these into every build under `data/`
 *   and serves them from the dev server.
 * - `scripts/writeLiveData.ts`, run by `.github/workflows/data-deploy.yml`,
 *   writes them straight onto the `gh-pages` branch for a commit that changed
 *   only a watch log, so that commit needs no build at all.
 *
 * Both have to agree byte for byte, which is why neither builds these itself.
 *
 * Node built-ins only: the data workflow runs this with Bun and no
 * `bun install`, so it can't import a package.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The fields of a `listFilms.json` summary that a row needs before anyone opens
 * it: what it is (title, year, poster), the trailer button, and the little the
 * collapsed row prints. Everything else (plot, cast, crew, ratings, tagline,
 * the full set of stills) is in the per-film file, fetched when the row's
 * details panel opens.
 *
 * Measured on the November 2026 cache: about 3.8 KB a film in full, about
 * 0.5 KB in this form. Add a field here only if a row draws it closed.
 */
const INDEX_FIELDS = [
    'imdbID',
    'title',
    'year',
    'poster',
    'runtime',
    'genre',
    'director',
    'trailerKey',
] as const;

/**
 * How many stills the index keeps. The collapsed row washes the first behind
 * itself, and the banner collages pick at random among a film's stills, so a
 * few keep them varied. The panel's stills strip shows the full set, from the
 * per-film file.
 */
const INDEX_STILLS = 3;

/** IMDb ids become file names, so only ones of that shape are written. */
const IMDB_ID = /^tt\d{7,10}$/;

type Summary = Record<string, unknown>;

/** One summary cut down to what the bundle and `films/index.json` carry. */
export function slimSummary(summary: Summary): Summary {
    const slim: Summary = {};
    for (const field of INDEX_FIELDS) {
        if (field in summary) slim[field] = summary[field];
    }
    const stills = summary.backdropImages;
    if (Array.isArray(stills) && stills.length > 0) {
        slim.backdropImages = stills.slice(0, INDEX_STILLS);
    }
    return slim;
}

/** The whole cache, slimmed. Keys keep the file's (sorted) order. */
export function slimIndex(cache: Record<string, Summary>): Record<string, Summary> {
    return Object.fromEntries(
        Object.entries(cache).map(([imdbID, summary]) => [imdbID, slimSummary(summary)])
    );
}

/**
 * A member's display name as a file name: `Jacob` → `jacob`.
 *
 * The same rule as the worker's `slugify` (`worker/src/validate.ts`), which
 * names the file it commits, and `memberSlug` in `src/types/watched.ts`, which
 * names the file the site fetches. `src/types/watched.test.ts` checks all three
 * agree.
 */
export function memberSlug(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

/**
 * The runtime data files under `data/`, as path → content.
 *
 * - `films/index.json`: the slim index. The bundle carries the same thing,
 *   built from the same function; this copy exists for films logged since the
 *   last full build, which a watch-log deploy publishes here and nowhere else.
 * - `films/<imdbID>.json`: one full summary each, for a row's details panel.
 * - `watched/<member>.json`: one log per club member, including an empty one
 *   for each member who has never logged anything, so the site can fetch any
 *   member's log without a 404.
 *
 * Throws on a malformed input file: a build or a data deploy that published a
 * half-read log would be worse than one that fails.
 */
export function liveDataFiles(assetsDir: string): Map<string, string> {
    const files = new Map<string, string>();

    const cache = readJson(join(assetsDir, 'listFilms.json'));
    if (typeof cache !== 'object' || cache === null || Array.isArray(cache)) {
        throw new Error('listFilms.json: expected an object keyed by IMDb id');
    }
    const summaries = cache as Record<string, Summary>;
    files.set('films/index.json', JSON.stringify(slimIndex(summaries)));
    for (const [imdbID, summary] of Object.entries(summaries)) {
        if (IMDB_ID.test(imdbID)) files.set(`films/${imdbID}.json`, JSON.stringify(summary));
    }

    const watchedDir = join(assetsDir, 'watched');
    const logs = existsSync(watchedDir)
        ? readdirSync(watchedDir).filter((name) => /^[a-z0-9-]+\.json$/.test(name))
        : [];
    for (const name of logs) {
        const entries = readJson(join(watchedDir, name));
        if (!Array.isArray(entries)) throw new Error(`watched/${name}: expected an array`);
        files.set(`watched/${name}`, JSON.stringify(entries));
    }

    const club = readJson(join(assetsDir, 'club.json'));
    if (!Array.isArray(club)) throw new Error('club.json: expected an array');
    for (const member of club as { name?: unknown }[]) {
        if (typeof member?.name !== 'string') continue;
        const path = `watched/${memberSlug(member.name)}.json`;
        if (!files.has(path)) files.set(path, '[]');
    }

    return files;
}
