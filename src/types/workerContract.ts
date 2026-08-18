/**
 * The client/server wire contract, checked by the compiler.
 *
 * The editing worker writes `lists.json`, `watched.json`, `club.json` and
 * `overrides.json`; this app reads them. The shapes describing those files exist
 * in three independently-maintained copies — `worker/src/types.ts`,
 * `src/types/*.ts`, and the request/response types in `src/api/clubApi.ts` —
 * because the worker deploys on its own and has no build-time link to the site
 * bundle. That duplication is deliberate, but nothing enforced it: the next
 * field added to one side would simply not exist on the other until something
 * broke in production, after a commit and a deploy, in front of a member.
 *
 * This file is that enforcement. It contains no runtime code and is imported by
 * nothing — `bun run typecheck` is what runs it, and a mismatch fails the build
 * with the offending property named.
 *
 * **The rule it encodes is strict writer, lenient reader.** The worker declares
 * every field it emits as required (`image: string | null`); the readers declare
 * the newer ones optional (`image?: string | null`), because entries written
 * before a field existed are still in the files and still have to load. So the
 * assertions are one-directional — a worker type must be assignable to its
 * reader counterpart, never the reverse — with a separate key-parity check,
 * since structural assignability alone permits extra properties and would let
 * exactly the additive drift this guards against pass.
 *
 * Adding a field: put it on the worker type and on the reader type in the same
 * change, required on the writer and optional on the reader.
 */

import type * as Worker from '../../worker/src/types';
import type {
    FilmOverride,
    FilmOverrideRecord,
    FilmPatch,
    FilmSearchResult,
    FilmSubmission,
    ListInput,
    OverridesFile,
    ProfilePatch,
    RatingOverride,
    RatingPatch,
    TrophyInput,
    WatchedPatch,
} from '../api/clubApi';
import type { FilmListDefinition, FilmListEntry } from './list';
import type { InterviewItem, TeamMember } from './team';
import type { TrophiesFile, Trophy } from './trophy';
import type { WatchedEntry, WatchedLog } from './watched';

/**
 * Fails to compile unless a value the worker wrote is a valid value to read.
 * The error lands on `Written` and names the incompatible property.
 */
type WriterFitsReader<Written extends Read, Read> = Written;

/**
 * Fails to compile on anything but `true`. The checks below resolve to the
 * drifted key names when they fail, so the compiler prints the field that broke
 * rather than a bare "false is not assignable".
 *
 * It has to be a separate step: a constraint inside a generic alias is checked
 * against the *parameter*, not the type eventually passed, so the assertion only
 * bites when instantiated with concrete types — which is what the maps below do.
 */
type Assert<Holds extends true> = Holds;

/** Both sides declare the same field names, whatever their optionality. */
type SameKeys<Written, Read> = [
    Exclude<keyof Written, keyof Read> | Exclude<keyof Read, keyof Written>,
] extends [never]
    ? true
    : Exclude<keyof Written, keyof Read> | Exclude<keyof Read, keyof Written>;

/** Every field the client sends is a field the worker knows; the rest is dropped silently. */
type FieldsTheWorkerStores<Sent, Stored> = [Exclude<Sent, keyof Stored>] extends [never]
    ? true
    : Exclude<Sent, keyof Stored>;

/**
 * The stored files: what the worker writes, and what `src/types` reads back.
 *
 * Exported because `noUnusedLocals` would otherwise discard the whole point of
 * the file. Nothing is meant to import it.
 */
export type StoredFileContract = {
    FilmListEntry: [
        WriterFitsReader<Worker.FilmListEntry, FilmListEntry>,
        Assert<SameKeys<Worker.FilmListEntry, FilmListEntry>>,
    ];
    FilmListDefinition: [
        WriterFitsReader<Worker.FilmListDefinition, FilmListDefinition>,
        Assert<SameKeys<Worker.FilmListDefinition, FilmListDefinition>>,
    ];
    WatchedEntry: [
        WriterFitsReader<Worker.WatchedEntry, WatchedEntry>,
        Assert<SameKeys<Worker.WatchedEntry, WatchedEntry>>,
    ];
    WatchedLog: WriterFitsReader<Worker.WatchedLog, WatchedLog>;
    TeamMember: [
        WriterFitsReader<Worker.TeamMember, TeamMember>,
        Assert<SameKeys<Worker.TeamMember, TeamMember>>,
    ];
    Trophy: [WriterFitsReader<Worker.Trophy, Trophy>, Assert<SameKeys<Worker.Trophy, Trophy>>];
    TrophiesFile: [
        WriterFitsReader<Worker.TrophiesFile, TrophiesFile>,
        Assert<SameKeys<Worker.TrophiesFile, TrophiesFile>>,
    ];
    InterviewItem: [
        WriterFitsReader<Worker.InterviewItem, InterviewItem>,
        Assert<SameKeys<Worker.InterviewItem, InterviewItem>>,
    ];
};

/**
 * The third copy: the shapes `clubApi.ts` re-declares because they never land in
 * a bundled file and so have no `src/types` home.
 *
 * `overrides.json` is the odd one — the worker writes it and
 * `.github/scripts/apply_overrides.py` reads it, folding the result into
 * `films.json`, so the app only ever sees these types on a write round-trip.
 */
export type ApiResponseContract = {
    RatingOverride: [
        WriterFitsReader<Worker.RatingOverride, RatingOverride>,
        Assert<SameKeys<Worker.RatingOverride, RatingOverride>>,
    ];
    FilmOverride: [
        WriterFitsReader<Worker.FilmOverride, FilmOverride>,
        Assert<SameKeys<Worker.FilmOverride, FilmOverride>>,
    ];
    FilmSubmission: [
        WriterFitsReader<Worker.FilmSubmission, FilmSubmission>,
        Assert<SameKeys<Worker.FilmSubmission, FilmSubmission>>,
    ];
    FilmOverrideRecord: [
        WriterFitsReader<Worker.FilmOverrideRecord, FilmOverrideRecord>,
        Assert<SameKeys<Worker.FilmOverrideRecord, FilmOverrideRecord>>,
    ];
    OverridesFile: [
        WriterFitsReader<Worker.OverridesFile, OverridesFile>,
        Assert<SameKeys<Worker.OverridesFile, OverridesFile>>,
    ];
    FilmSearchResult: [
        WriterFitsReader<Worker.FilmSearchResult, FilmSearchResult>,
        Assert<SameKeys<Worker.FilmSearchResult, FilmSearchResult>>,
    ];
};

/**
 * The other direction: fields the client *sends*.
 *
 * A patch is a partial write, so it is never assignable to the stored shape —
 * what has to hold is narrower and is the failure mode that actually happens:
 * every key a patch carries must be one the worker recognizes, or the member's
 * edit is accepted, committed, and silently absent from the file.
 *
 * `owner` is excluded throughout. It rides along on every write so an admin can
 * act on someone else's data, and is a routing field the worker consumes rather
 * than a field it stores.
 */
export type RequestContract = {
    RatingPatch: Assert<
        FieldsTheWorkerStores<Exclude<keyof RatingPatch, 'owner'>, Worker.RatingOverride>
    >;
    /**
     * A film patch carries no `owner`: a film's record belongs to the club
     * rather than to a member, so there is no row to route it to — which is why
     * every member may write one and why nothing here needs excluding.
     */
    FilmPatch: Assert<FieldsTheWorkerStores<keyof FilmPatch, Worker.FilmOverride>>;
    WatchedPatch: Assert<
        FieldsTheWorkerStores<Exclude<keyof WatchedPatch, 'owner'>, Worker.WatchedEntry>
    >;
    ProfilePatch: Assert<
        FieldsTheWorkerStores<Exclude<keyof ProfilePatch, 'owner'>, Worker.TeamMember>
    >;
    ListEntryInput: Assert<
        FieldsTheWorkerStores<keyof ListInput['entries'][number], Worker.FilmListEntry>
    >;
    ListInput: Assert<
        FieldsTheWorkerStores<
            Exclude<keyof ListInput, 'owner' | 'entries'>,
            Worker.FilmListDefinition
        >
    >;
    /**
     * A trophy write carries no `owner`: the field that decides who may change
     * an award is `awardedBy`, and the worker takes that from the token rather
     * than the body — so unlike the writes above there is nothing to exclude.
     */
    TrophyInput: Assert<FieldsTheWorkerStores<keyof TrophyInput, Worker.Trophy>>;
};
