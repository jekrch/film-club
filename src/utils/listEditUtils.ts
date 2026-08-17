import type { FilmSearchResult, ListInput } from '../api/clubApi';
import type { FilmListDefinition } from '../types/list';
import { parseImageUrl } from './imageUrl';
import { resolveListEntry, type ListDataSources, type ScoreSource } from './listUtils';
import { parseScoreField } from './ratingEditUtils';
import { parseTrailerLink } from './youtube';

/**
 * The pure half of the list editor: the draft a member is building, and what it
 * has to become for the worker to accept it.
 *
 * The list editor is the odd one of the four — a rating, a watch-log entry and a
 * profile are each a single record, while a list is an *ordered collection*, so
 * the draft here is an array with its own add, move, patch and remove rules
 * rather than a form. What it shares with {@link ./watchedEditUtils} and the
 * other two is the shape of the deal: every field is validated by the same
 * parsers the worker uses, so a mistake is caught while the member is still
 * looking at the field rather than after a round trip. The worker validates
 * again regardless — this is convenience, not trust.
 *
 * Writes are whole-list rather than per-entry, so there is no patch builder
 * here: the draft becomes a complete {@link ListInput} and replaces what was
 * stored (§8.4).
 */

/**
 * One row of the draft: what the member typed, plus the metadata the row needs
 * to draw itself before anything is saved.
 *
 * Every editable field is a string because every one of them is an input's
 * value — `''` is "unset", which is what lets the score field fall back to
 * {@link inheritedScore} instead of storing a zero.
 */
export interface DraftEntry {
    imdbID: string;
    description: string;
    /** The member's own background art for the row; empty means the film's own. */
    image: string;
    /** The member's own poster for the film; empty means the one OMDB supplied. */
    posterImage: string;
    /** The member's own trailer link as typed; empty means the film's own. */
    trailer: string;
    /** True when this row should offer no trailer at all; wins over {@link trailer}. */
    hideTrailer: boolean;
    /** The owner's score for this pick, empty for "whatever I've scored it elsewhere". */
    score: string;
    /**
     * The score the row would show if {@link score} stays empty — from the
     * owner's watch log or their club rating — and where it comes from. Shown as
     * the field's placeholder so nobody retypes a score they already gave.
     */
    inheritedScore: number | null;
    inheritedFrom: ScoreSource | null;
    title: string | null;
    year: string | null;
    /**
     * The *film's* poster, never the member's override — the row draws
     * {@link posterImage} over it and has to be able to fall back the moment
     * that field is cleared, which a resolved poster with the override already
     * baked in couldn't do.
     */
    poster: string | null;
}

/** How an inherited score reads in the hint under the field. */
export const INHERITED_FROM_LABEL: Record<ScoreSource, string> = {
    entry: 'this list',
    log: 'your watch log',
    club: 'your club rating',
};

/** Matches the worker's caps, so a draft can't be built that the save would reject. */
export const LIST_LIMITS = {
    name: 80,
    description: 1000,
    entryDescription: 500,
    entries: 100,
};

/** How a row names itself in labels and error messages. An id is all an unresolved film has. */
export const draftLabel = (entry: Pick<DraftEntry, 'title' | 'imdbID'>): string =>
    entry.title ?? entry.imdbID;

/**
 * What the row's thumbnail shows: the member's poster while they are still
 * typing it, and the film's own the moment that field is cleared.
 */
export const draftRowPoster = (entry: Pick<DraftEntry, 'posterImage' | 'poster'>): string | null =>
    entry.posterImage.trim() === '' ? entry.poster : entry.posterImage.trim();

/**
 * The sentence under the score field, or null when the member has scored this
 * film nowhere else.
 *
 * The two wordings are the point: an empty field is *showing* the score they
 * already gave, and a filled one is *overriding* it. Without that, a placeholder
 * and a value look the same at a glance and it isn't clear which the list will
 * publish.
 */
export const inheritedScoreHint = (
    entry: Pick<DraftEntry, 'score' | 'inheritedScore' | 'inheritedFrom'>
): string | null => {
    if (entry.inheritedScore === null || entry.inheritedFrom === null) return null;
    const inherited = `${entry.inheritedScore} from ${INHERITED_FROM_LABEL[entry.inheritedFrom]}`;
    return entry.score.trim() === '' ? `Showing ${inherited}.` : `Overrides ${inherited}.`;
};

/**
 * What the row would score without a score of its own — the owner's watch log,
 * then their club rating. Resolved from an entry with its score stripped, so it
 * answers "what does this fall back to" rather than "what does it show now".
 */
export const inheritedScoreFor = (
    imdbID: string,
    owner: string | undefined,
    sources: ListDataSources = {}
): Pick<DraftEntry, 'inheritedScore' | 'inheritedFrom'> => {
    const { score, scoreSource } = resolveListEntry(
        { rank: 0, imdbID, description: null, score: null },
        sources,
        owner
    );
    return { inheritedScore: score, inheritedFrom: scoreSource };
};

/** A stored list as a draft, in rank order. */
export const toDraftEntries = (
    list: FilmListDefinition,
    sources: ListDataSources = {}
): DraftEntry[] =>
    [...list.entries]
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
            // Resolved with the poster override stripped, so `poster` is the
            // film's own — see {@link DraftEntry.poster}. Everywhere outside
            // this editor wants the resolved poster and passes the entry whole.
            const resolved = resolveListEntry({ ...entry, posterImage: null }, sources, list.owner);
            return {
                imdbID: entry.imdbID,
                description: entry.description ?? '',
                image: entry.image ?? '',
                posterImage: entry.posterImage ?? '',
                trailer: entry.trailerKey ?? '',
                hideTrailer: entry.hideTrailer ?? false,
                score: entry.score === null || entry.score === undefined ? '' : String(entry.score),
                ...inheritedScoreFor(entry.imdbID, list.owner, sources),
                title: resolved.title,
                year: resolved.year,
                poster: resolved.poster,
            };
        });

/**
 * A search hit as a new row. Its title, year and poster come from the hit
 * itself, so a film just added draws immediately rather than waiting on the CI
 * step that fills `listFilms.json` (§8.8).
 */
export const draftEntryFromSearch = (
    hit: FilmSearchResult,
    owner: string | undefined,
    sources: ListDataSources = {}
): DraftEntry => ({
    imdbID: hit.imdbID,
    description: '',
    image: '',
    posterImage: '',
    trailer: '',
    hideTrailer: false,
    score: '',
    // A film just added may already be one the member has watched or scored with
    // the club, and the row should say so from the moment it appears.
    ...inheritedScoreFor(hit.imdbID, owner, sources),
    title: hit.title,
    year: hit.year,
    poster: hit.poster,
});

/**
 * Adding a film either extends the draft or explains why it didn't.
 *
 * A refusal is a `notice` rather than an error: neither case is a mistake the
 * member has to fix before saving, and the draft is untouched either way.
 */
export type AddFilmResult = { entries: DraftEntry[] } | { notice: string };

export const addFilmToDraft = (
    entries: DraftEntry[],
    hit: FilmSearchResult,
    owner: string | undefined,
    sources: ListDataSources = {}
): AddFilmResult => {
    if (entries.some((entry) => entry.imdbID === hit.imdbID)) {
        return { notice: `${hit.title} is already on this list.` };
    }
    if (entries.length >= LIST_LIMITS.entries) {
        return { notice: `A list holds at most ${LIST_LIMITS.entries} films.` };
    }
    return { entries: [...entries, draftEntryFromSearch(hit, owner, sources)] };
};

/**
 * The arrow controls' half of reordering — a swap with the neighbour. Dragging
 * is the other half and framer-motion owns it.
 *
 * Returns the array unchanged when the move would leave the list, so the caller
 * can move past the ends without a state write or a false "unsaved changes".
 */
export const moveDraftEntry = (
    entries: DraftEntry[],
    index: number,
    direction: -1 | 1
): DraftEntry[] => {
    const target = index + direction;
    if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) {
        return entries;
    }
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
};

/** Replaces one row's editable fields, leaving the rest of the draft alone. */
export const patchDraftEntry = (
    entries: DraftEntry[],
    imdbID: string,
    patch: Partial<DraftEntry>
): DraftEntry[] =>
    entries.map((entry) => (entry.imdbID === imdbID ? { ...entry, ...patch } : entry));

export const removeDraftEntry = (entries: DraftEntry[], imdbID: string): DraftEntry[] =>
    entries.filter((entry) => entry.imdbID !== imdbID);

/** The draft as the worker's input, or the first thing wrong with it. */
export type ListInputResult = { input: ListInput } | { error: string };

/**
 * Validates the whole draft and builds the save payload.
 *
 * Checked here rather than on every keystroke: a half-typed URL is not a mistake
 * yet. The row is named in every message, so a hundred-film list doesn't turn
 * into a hunt for which one is wrong — which also means the first failure is
 * reported and the rest are not, in row order.
 *
 * `rank` is absent by design. It is positional and the worker renumbers on save,
 * so the order of `entries` *is* the ranking.
 */
export function buildListInput(draft: {
    name: string;
    description: string;
    ranked: boolean;
    entries: DraftEntry[];
}): ListInputResult {
    const name = draft.name.trim();
    if (name === '') return { error: 'A list needs a name.' };

    const entries: ListInput['entries'] = [];
    for (const entry of draft.entries) {
        const label = draftLabel(entry);

        const image = parseImageUrl(entry.image);
        if ('error' in image) return { error: `${label}, background image: ${image.error}` };

        const posterImage = parseImageUrl(entry.posterImage);
        if ('error' in posterImage) return { error: `${label}, poster: ${posterImage.error}` };

        const trailer = parseTrailerLink(entry.trailer);
        if ('error' in trailer) return { error: `${label}, trailer: ${trailer.error}` };

        const score = parseScoreField(entry.score);
        if ('error' in score) return { error: `${label}: ${score.error}` };

        const description = entry.description.trim();
        entries.push({
            imdbID: entry.imdbID,
            description: description === '' ? null : description,
            image: image.value,
            posterImage: posterImage.value,
            trailerKey: trailer.value,
            hideTrailer: entry.hideTrailer,
            score: score.score,
        });
    }

    const description = draft.description.trim();
    return {
        input: {
            name,
            description: description === '' ? null : description,
            ranked: draft.ranked,
            entries,
        },
    };
}

/**
 * A member's profile page, or `/about` when there is nobody to show one for —
 * which is where a deleted list leaves you, since its own page is gone.
 */
export const profilePath = (member: string | null | undefined): string =>
    member ? `/profile/${encodeURIComponent(member)}` : '/about';

/**
 * Where leaving the editor without saving goes: the list's own page when there
 * is one, and otherwise the owner's profile, since a create that never happened
 * has no page to return to. On a create the owner is whoever is signed in.
 */
export const listExitPath = (where: {
    listId: string | undefined;
    owner: string | null;
    member: string | null;
}): string => (where.listId ? `/lists/${where.listId}` : profilePath(where.owner ?? where.member));
