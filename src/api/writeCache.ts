/**
 * A short-lived record of this tab's own saves, used to bridge a stale read.
 *
 * The live copies of the editable files are now fetched from
 * `raw.githubusercontent.com` rather than through the worker (see `repoData.ts`
 * for why). That costs nothing and needs no token, but raw serves
 * `cache-control: max-age=300` — so for up to five minutes after a save the
 * fetched file can still be the version before it. Re-reading would then show a
 * member the value they just replaced, which reads exactly like a save that
 * failed. That regression is what this module exists to prevent.
 *
 * Every write already returns the stored record, so the authoritative value is
 * in hand the moment a save succeeds. Recording it here lets a *later* read —
 * a reload, a navigation, a second editor on another page — be corrected with
 * it while the CDN catches up.
 *
 * `sessionStorage`, deliberately, for the same reasons the token uses it: it
 * survives reload and in-tab navigation, and it dies with the tab. A stale
 * overlay can therefore never outlive the session that created it, which caps
 * how wrong this can be if the reconciliation below somehow never fires.
 */

const KEY = 'cc.editor.writes';

/**
 * Backstop expiry. Entries normally clear themselves the moment a fetch agrees
 * with them ({@link reconcile}), so this only catches ones that never will —
 * a save another member has since overwritten, most likely. Long enough to
 * outlast any plausible deploy, short enough that a day-old tab isn't still
 * insisting on it.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

/** Which file an entry belongs to. One namespace per file keeps keys short. */
export type WriteKind = 'rating' | 'list' | 'watched' | 'profile' | 'trophy' | 'film';

/** A recorded write. `value: null` is a delete — the row should be absent. */
interface CachedWrite<T> {
    value: T | null;
    at: number;
}

type Store = Partial<Record<WriteKind, Record<string, CachedWrite<unknown>>>>;

/**
 * Key order is not guaranteed to match between the worker's response and the
 * committed file it later serves, so equality is checked on a canonical form
 * rather than raw `JSON.stringify`. Getting this wrong would only mean an entry
 * lingers until the TTL — it would still hold the same value — but a cheap
 * sort makes the common case exact.
 */
function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** Storage throws in private modes and quota-full origins; none of that is fatal here. */
function read(): Store {
    try {
        const raw = sessionStorage.getItem(KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Store) : {};
    } catch {
        return {};
    }
}

function write(store: Store): void {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(store));
    } catch {
        // No bridge in this browser. Saves still work; a read inside the CDN
        // window may briefly show the previous value, which is the behavior
        // this module improves on rather than one it is required for.
    }
}

/**
 * Notes the authoritative result of one save. Pass `null` for a delete.
 *
 * Called from the same place each editor already folds a write into its local
 * state, so the in-page update and the cross-page one stay together and a new
 * editor can't easily do one without the other.
 */
export function recordWrite<T>(kind: WriteKind, key: string, value: T | null): void {
    const store = read();
    const bucket = store[kind] ?? {};
    bucket[key] = { value, at: Date.now() };
    store[kind] = bucket;
    write(store);
}

/**
 * This tab's unexpired writes for one file, newest state per key.
 *
 * Returns a plain map so callers can merge it into whatever shape the file
 * has — the four differ enough that a generic merge here would be worse than
 * four explicit ones at the call sites.
 */
export function pendingWrites<T>(kind: WriteKind): Map<string, T | null> {
    const bucket = read()[kind];
    const result = new Map<string, T | null>();
    if (!bucket) return result;

    const cutoff = Date.now() - TTL_MS;
    for (const [key, entry] of Object.entries(bucket)) {
        if (entry.at >= cutoff) result.set(key, entry.value as T | null);
    }
    return result;
}

/**
 * Drops the entries a freshly fetched file has caught up with.
 *
 * `source` is what the file itself now says for each recorded key — `null` when
 * the row is absent from it. Once the two agree the overlay is redundant, and
 * leaving it in place would mean a save from another tab or another member
 * silently losing to a value this tab already got its confirmation for.
 *
 * This is the same comparison the deploy does in reverse: the worker commits,
 * CI folds the file into the bundle, and equality is what proves the round trip
 * finished.
 */
export function reconcile(kind: WriteKind, source: Map<string, unknown>): void {
    const store = read();
    const bucket = store[kind];
    if (!bucket) return;

    let changed = false;
    const cutoff = Date.now() - TTL_MS;

    for (const [key, entry] of Object.entries(bucket)) {
        // An expired entry is dropped whether or not the source mentions it;
        // this is the only pass that ever visits one, so it is also the only
        // chance to stop the bucket growing forever.
        const expired = entry.at < cutoff;
        const settled =
            source.has(key) && canonical(source.get(key) ?? null) === canonical(entry.value);
        if (expired || settled) {
            delete bucket[key];
            changed = true;
        }
    }

    if (changed) {
        if (Object.keys(bucket).length === 0) delete store[kind];
        else store[kind] = bucket;
        write(store);
    }
}

/** Forgets everything. Called on sign-out, so a shared machine starts clean. */
export function clearWrites(): void {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // Nothing to clear if nothing could be written.
    }
}

/**
 * Keys, in one place, so a reader and a writer cannot disagree on the shape.
 *
 * The two-part keys put the IMDb id first because a member's display name may
 * contain a space and an IMDb id may not — which is what lets {@link splitKey}
 * take one back apart on its first space.
 */
export const writeKeys = {
    rating: (imdbId: string, member: string) => `${imdbId} ${member.toLowerCase()}`,
    list: (id: string) => id,
    watched: (owner: string, imdbId: string) => `${imdbId} ${owner.toLowerCase()}`,
    profile: (name: string) => name.toLowerCase(),
    /**
     * The second part is the award's id rather than a member: a trophy is keyed
     * by which award it is, not by whose it is, since one member can hold two on
     * the same film. Slugs contain no spaces, so {@link splitKey} takes it apart
     * on the same rule as the others.
     */
    trophy: (imdbId: string, id: string) => `${imdbId} ${id}`,
    /**
     * One key per film, with no second part: a film's club record belongs to
     * the film rather than to a member, so there is nothing to key it by but
     * the id.
     */
    film: (imdbId: string) => imdbId,
};

/** Splits a two-part key back into its IMDb id and its second part. */
export function splitKey(key: string): { imdbId: string; owner: string } {
    const at = key.indexOf(' ');
    return at === -1
        ? { imdbId: key, owner: '' }
        : { imdbId: key.slice(0, at), owner: key.slice(at + 1) };
}
