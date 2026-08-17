/**
 * Shared types for the editing worker.
 *
 * The list and override shapes here mirror `src/types/list.ts` and the
 * `overrides.json` schema that `.github/scripts/apply_overrides.py` reads. They
 * are duplicated rather than imported because the worker deploys on its own and
 * has no build-time link to the site bundle; if either side changes, both must.
 */

/** Bindings declared in `wrangler.toml` plus the secrets set with `wrangler secret put`. */
export interface Env {
    /** OAuth web client ID; the `aud` every ID token must carry. */
    GOOGLE_CLIENT_ID: string;
    /** `owner/repo` the worker commits to. */
    GITHUB_REPO: string;
    /** Comma-separated list of origins allowed to call the worker. */
    ALLOWED_ORIGIN: string;
    /** Fine-grained PAT, Contents: read and write, this repo only. */
    GITHUB_TOKEN: string;
    /** JSON object mapping a verified Google email to a `club.json` member name. */
    MEMBER_EMAILS: string;
    /** JSON array (or comma-separated list) of emails allowed to edit anyone's data. */
    ADMIN_EMAILS: string;
    /** Used only by the film-search proxy, so the key never ships in the bundle. */
    OMDB_API_KEY: string;
}

/** A caller resolved from a verified ID token. */
export interface Member {
    /** The `club.json` display name, e.g. `Andy`. */
    name: string;
    /** Lowercased verified Google email. */
    email: string;
    admin: boolean;
}

/** One film on a list. `rank` is 1-based and positional — the worker renumbers on save. */
export interface FilmListEntry {
    rank: number;
    imdbID: string;
    description: string | null;
    /** An `https` image the member picked as the row's background art, or null. */
    image: string | null;
    /** An `https` image the member picked as the film's poster, or null. */
    posterImage: string | null;
    /** A YouTube video key the member picked as this film's trailer, or null. */
    trailerKey: string | null;
    /** True when the row should offer no trailer at all; wins over `trailerKey`. */
    hideTrailer: boolean;
    /**
     * The owner's score for this pick out of 9, or null when they gave none
     * here — the site then falls back to their watch log and club rating, which
     * is a read-side concern the worker takes no part in.
     */
    score: number | null;
}

/** A single member-curated list, exactly as it is stored in `lists.json`. */
export interface FilmListDefinition {
    id: string;
    name: string;
    owner: string;
    description: string | null;
    /** Whether the list's order renders as a numbered ranking. */
    ranked: boolean;
    entries: FilmListEntry[];
}

/**
 * One film a member watched on their own, as stored in `watched.json`.
 *
 * Unlike {@link RatingOverride} every field is always present, `null` when
 * unset. There is no presence semantics to honor here because there is no
 * second writer: the sheet knows nothing about personal watches, so a blank is
 * simply a blank rather than "defer to whatever the sheet said".
 */
export interface WatchedEntry {
    imdbID: string;
    /** `YYYY-MM-DD`. Sorts lexicographically, which is why it isn't the sheet's `MM/DD/YYYY`. */
    watchDate: string;
    score: number | null;
    scoreQualifier: string | null;
    blurb: string | null;
    /** An `https` image the member picked as the row's background art, or null. */
    image: string | null;
    /** An `https` image the member picked as the film's poster, or null. */
    posterImage: string | null;
    /** A YouTube video key the member picked as this film's trailer, or null. */
    trailerKey: string | null;
    /** True when the row should offer no trailer at all; wins over `trailerKey`. */
    hideTrailer: boolean;
    updatedAt: string;
}

/**
 * The shape of `src/assets/watched.json`: member display name → their log,
 * newest watch first.
 *
 * Keyed by member rather than a flat array with an `owner` field (the shape
 * `lists.json` uses) because all six members write this one file and a keyed
 * object keeps each person's edits to their own hunk of the diff.
 *
 * **Nothing in here ever reaches `films.json`.** `apply_overrides.py` reads
 * `overrides.json` only, so a personal watch cannot enter club data, the
 * almanac, or any statistic — a member may log a film the club also watched,
 * and the two scores stay independent by construction.
 */
export type WatchedLog = Record<string, WatchedEntry[]>;

/**
 * One member's edits to their rating of one film.
 *
 * Presence is meaningful: a key that is absent means "the sheet's value stands",
 * an explicit `null` means "deliberately blank". See §8.7 of the plan.
 */
export interface RatingOverride {
    score?: number | null;
    scoreQualifier?: string | null;
    blurb?: string | null;
    /** Provenance only — `apply_overrides.py` whitelists the three fields above. */
    updatedBy: string;
    updatedAt: string;
}

/** The shape of `src/assets/overrides.json`. */
export interface OverridesFile {
    films: Record<string, { ratings: Record<string, RatingOverride> }>;
}

/** One question and answer on a member's profile interview. */
export interface InterviewItem {
    question: string;
    /** Markdown, like a bio. */
    answer: string;
}

/**
 * Where a member's profile banner gets its art. Mirrors `BackdropMode` in
 * `src/types/team.ts`; `top-rated` is the default and is stored as an absent
 * field rather than the string.
 */
export type BackdropMode = 'top-rated' | 'selected';

/**
 * One club member, exactly as `club.json` stores them. Mirrors `TeamMember` in
 * `src/types/team.ts`.
 *
 * `name` is the join key for the entire site — every rating, list, and watch log
 * is keyed by it — so the worker treats it as immutable and edits nothing else
 * structural. `queue` (the selection rotation) and `color` (a Tailwind token the
 * charts read) are club-wide settings rather than personal ones, and are equally
 * off-limits to a profile write; see `PROFILE_FIELDS` in `validate.ts`.
 */
export interface TeamMember {
    name: string;
    title: string;
    bio: string;
    image: string;
    url?: string;
    queue?: number;
    color?: string;
    interview?: InterviewItem[];
    /** Absent means `top-rated`, which is what every profile was before this existed. */
    backdropMode?: BackdropMode;
    /** IMDb ids, in the order the member chose them. Only read in `selected` mode. */
    backdropFilms?: string[];
}

/** A single OMDB search hit, trimmed to what the add-film picker needs. */
export interface FilmSearchResult {
    imdbID: string;
    title: string;
    year: string | null;
    poster: string | null;
}
