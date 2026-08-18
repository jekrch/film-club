import trophiesData from '../assets/trophies.json';

/**
 * The awards the club hands out, as members now record them on the site.
 *
 * There have always been trophies — the Togetherness Trophy, the Bad Boy, the
 * Helmet — but until now they lived in one free-text `trophyNotes` cell per film
 * in the Google Sheet ("Joey gets both togetherness and bad boy, Andy gets
 * reframer trophy"). Every surface that drew one had to guess at the seams:
 * split on commas, regex the six member names out of the prose, and hope.
 *
 * This file is the structured half. A trophy written here names its recipient as
 * a field rather than as a substring, which is what lets a member's shelf be a
 * filter instead of a text search — and what makes the award editable at all.
 * The sheet's column keeps working and keeps rendering; `trophyUtils.ts` reads
 * both into one shape, and nothing migrates. See {@link ResolvedTrophy} there.
 */

/** One award, exactly as the worker stores it. Mirrors `Trophy` in `worker/src/types.ts`. */
export interface Trophy {
    /**
     * `slugify(recipient + "-" + award)`, assigned by the worker on create and
     * immutable after — so fixing a typo in `award` doesn't change the row's
     * identity, and the editor keeps its handle on it.
     */
    id: string;
    /** A `club.json` display name, e.g. `Andy`. */
    recipient: string;
    /** What the award is called, e.g. `Togetherness Trophy`. */
    award: string;
    /** Why they got it, e.g. `for having a lot of work to do`. Null when unsaid. */
    note: string | null;
    /**
     * Who handed it out. Provenance, and also the permission: the worker lets
     * that member (or an admin) edit and withdraw the award, and nobody else —
     * including the recipient.
     */
    awardedBy: string;
    awardedAt: string;
}

/** `trophies.json`: IMDb id → the awards on that film, oldest first. */
export interface TrophiesFile {
    films: Record<string, Trophy[]>;
}

/**
 * Validates the bundled awards at module-load time.
 *
 * Same reasoning as `assertFilmData` and `assertWatchedData`: the file is
 * written by the editor worker, so it is untyped at import and a malformed
 * record would otherwise surface as an opaque crash deep in a render.
 * Intentionally shallow — it checks the fields the galleries key and group on,
 * not the full schema, since the worker validates on write.
 */
function assertTrophyData(data: unknown): TrophiesFile {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error('trophies.json: expected an object');
    }

    const films = (data as Partial<TrophiesFile>).films;
    if (films === undefined) return { films: {} };
    if (typeof films !== 'object' || films === null || Array.isArray(films)) {
        throw new Error('trophies.json: "films" must be an object keyed by IMDb id');
    }

    Object.entries(films as Record<string, unknown>).forEach(([imdbId, trophies]) => {
        if (!Array.isArray(trophies)) {
            throw new Error(`trophies.json[${imdbId}]: expected an array of trophies`);
        }
        trophies.forEach((trophy, index) => {
            const t = trophy as Partial<Trophy> | null;
            if (typeof t !== 'object' || t === null || typeof t.id !== 'string') {
                throw new Error(
                    `trophies.json[${imdbId}]: trophy ${index} missing or invalid "id"`
                );
            }
            if (typeof t.recipient !== 'string' || t.recipient.length === 0) {
                throw new Error(
                    `trophies.json[${imdbId}] (${t.id}): missing or invalid "recipient"`
                );
            }
            if (typeof t.award !== 'string' || t.award.length === 0) {
                throw new Error(`trophies.json[${imdbId}] (${t.id}): missing or invalid "award"`);
            }
        });
    });

    return data as TrophiesFile;
}

/**
 * Every award as of the last build.
 *
 * Bundled rather than fetched, like `lists.json` and `watched.json` and for the
 * same reason: a trophy is part of what the site *is*, and a visitor should see
 * one without a network round trip. A member who has just given one sees it
 * sooner than the next deploy through `TrophiesContext`, which overlays the live
 * file on top of this.
 */
export const trophyIndex = assertTrophyData(trophiesData);

/** The awards on one film as of the last build. Empty for a film with none. */
export const getBundledTrophies = (imdbId: string): Trophy[] => trophyIndex.films[imdbId] ?? [];
