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
 * One award the club handed a member for one film, as stored in `trophies.json`.
 *
 * Unlike a rating or a watch-log entry this is not a record of the caller's own
 * contribution: a trophy is something members give *each other*, so `recipient`
 * and `awardedBy` are different people in the ordinary case. That is why the
 * ownership check on this write is not the usual "you may only edit your own" —
 * see `resolveTrophyEditor` in `validate.ts` for the rule that replaces it.
 *
 * `id` is assigned by the worker on create and immutable afterwards, so an award
 * can be renamed without the client losing its handle on the row.
 */
export interface Trophy {
    id: string;
    /** A `club.json` display name, e.g. `Andy`. */
    recipient: string;
    /** What the award is called, e.g. `Togetherness Trophy`. */
    award: string;
    /** Why they got it, e.g. `for having a lot of work to do`. Null when unsaid. */
    note: string | null;
    /** Provenance: the member who handed it out. Fixed at create. */
    awardedBy: string;
    awardedAt: string;
}

/**
 * The shape of `src/assets/trophies.json`: IMDb id → the awards on that film.
 *
 * Keyed by film rather than by member — the mirror image of {@link WatchedLog} —
 * because a trophy belongs to a screening. Every surface that shows one starts
 * from a film, and a member's shelf is a filter across the whole set rather than
 * a key lookup.
 */
export interface TrophiesFile {
    films: Record<string, Trophy[]>;
}

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

/**
 * The club-level and presentation fields members edit on a film.
 *
 * Presence is meaningful here for the same reason it is on {@link RatingOverride}:
 * `films.json` has two writers behind it — the sheet and this worker — so an
 * absent key means "whatever the sheet says stands" and an explicit `null` means
 * "deliberately blank". A member fixing a film's cover must not blank the
 * selector the sheet supplied.
 *
 * `poster` and `backdropImage` are presentation rather than club record: the
 * first replaces OMDb's cover art, which is frequently the wrong edition or a
 * washed-out scan, and the second is the wide still behind the selection
 * committee and the film's own page. Both were hand-edits to `films.json` until
 * now, which is why 23 films have a `backdropImage` and nobody could add the
 * 24th without a commit.
 */
export interface FilmOverride {
    /** A `club.json` display name — whose pick it was. Null when unrecorded. */
    selector?: string | null;
    /** `MM/DD/YYYY`, the form `films.json` already stores. Null when unwatched. */
    watchDate?: string | null;
    /** An `https` cover to use in place of OMDb's, or null for OMDb's. */
    poster?: string | null;
    /** An `https` wide still for the hero background, or null for TMDb's. */
    backdropImage?: string | null;
    /** Provenance only — `apply_overrides.py` whitelists the four fields above. */
    updatedBy: string;
    updatedAt: string;
}

/**
 * The marker that says a film entered the club on the site rather than through
 * the Google Sheet.
 *
 * It is what `create_submitted_films.py` looks for: an id carrying this and
 * absent from `films.json` is one CI still has to fetch from OMDb and TMDb. The
 * worker cannot write `films.json` (§8.1) and would have to hold OMDb's whole
 * response to try, so what it commits is this — the intent — and CI builds the
 * record on the next deploy, about a minute later.
 *
 * `title` and `year` are OMDb's, read once when the submission is accepted. They
 * are not club data and nothing renders them once the film lands; they exist so
 * the pending state can name the film rather than an id, in the editor and in
 * the CI log.
 */
export interface FilmSubmission {
    /** The member who added it. */
    addedBy: string;
    addedAt: string;
    /** OMDb's title at submission time. */
    title: string;
    /** OMDb's release year, or null when it had none. */
    year: string | null;
}

/**
 * Everything recorded against one film in `overrides.json`.
 *
 * `ratings` is always present, `{}` included, so a film added for its art alone
 * still has the shape every reader expects.
 */
export interface FilmOverrideRecord {
    ratings: Record<string, RatingOverride>;
    film?: FilmOverride;
    added?: FilmSubmission;
}

/** The shape of `src/assets/overrides.json`. */
export interface OverridesFile {
    films: Record<string, FilmOverrideRecord>;
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
