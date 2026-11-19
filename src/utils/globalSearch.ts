import { filmData, type Film } from '../types/film';
import { filmLists, isRankedList, type FilmListDefinition } from '../types/list';
import { getTeamMemberByName, teamMembers, type TeamMember } from '../types/team';
import type { WatchedLog } from '../types/watched';
import { parseWatchDate } from './filmUtils';
import { resolveListEntries } from './listUtils';
import { calculateClubAverage } from './ratingUtils';
import { getClubTrophies, type MemberTrophy } from './trophyUtils';
import {
    formatWatchDate,
    formatWatchedScore,
    resolveWatchedEntry,
    watchedPathFor,
    watchedRowId,
} from './watchedUtils';

/**
 * The site-wide search behind the nav's search button.
 *
 * The Log page's own search narrows one timeline. This one reaches every record
 * the site has — club films and the people who made them, members, lists, the
 * films members logged on their own, every review written on either, and every
 * trophy — and answers with the thing itself rather than the row it appeared on,
 * so a hit on a director lands on the film and a hit on a review says whose it
 * was and what they gave it.
 *
 * Built in two halves, both pure: {@link buildSearchIndex} flattens the data into
 * documents once, folding every field for matching ahead of time, and
 * {@link searchIndex} ranks them against a query on each keystroke. Nothing here
 * writes, and it reads the same bundled files and fetched logs the pages do.
 */

export type SearchGroupKey = 'page' | 'film' | 'member' | 'list' | 'log' | 'review' | 'trophy';

/** What sits at the left of a result. */
export type SearchThumb =
    | { kind: 'poster'; src: string | null }
    | { kind: 'avatar'; name: string }
    /** A page's own glyph, or a trophy's — keyed, so the component picks the icon. */
    | { kind: 'icon'; key: string };

export interface SearchResult {
    /** Unique across the whole index. */
    id: string;
    group: SearchGroupKey;
    title: string;
    /** Quiet text after the title: a film's year. */
    titleSuffix?: string | null;
    /** A small flag beside the title, such as "Up next". */
    badge?: string | null;
    /** The second line, as separate facts the component joins. */
    meta: string[];
    thumb: SearchThumb;
    /** The number at the right, and what it is the score *of*. */
    score?: { value: string; numeric: number; label: string } | null;
    /**
     * A passage to show under the meta line. A review always carries its own
     * words; anything else carries one only once a query has matched it
     * somewhere other than its title (see {@link RankedResult.context}).
     */
    quote?: string | null;
    href: string;
    /** `YYYY-MM-DD` where the record has a day, for breaking ties toward the recent. */
    date?: string | null;
}

/** One searchable field of a document. */
interface SearchField {
    /** As displayed, for the snippet. */
    text: string;
    /** Lowercased and accent-folded, for matching. */
    folded: string;
    weight: number;
    /**
     * What to call this field when a match on it is the reason the result is
     * here — "Directed by", "Starring". Absent on the title, which needs no
     * explaining.
     */
    label?: string;
    /**
     * A comma-separated list, such as a cast. The snippet is then the matching
     * items rather than a window into the whole string, so a hit on one actor
     * reads "Starring Toshiro Mifune" rather than the top of the cast.
     */
    list?: boolean;
    /**
     * Prose, matched only once the query has some length to it: a one- or
     * two-letter query that hits the middle of a plot summary is noise.
     */
    prose?: boolean;
}

export interface SearchDoc {
    result: SearchResult;
    fields: SearchField[];
}

/** Lowercased with accents folded, so "amelie" finds Amélie. */
export const foldForSearch = (text: string): string =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const field = (
    text: string | null | undefined,
    weight: number,
    options: Omit<SearchField, 'text' | 'folded' | 'weight'> = {}
): SearchField | null => {
    const trimmed = text?.trim();
    if (!trimmed) return null;
    return { text: trimmed, folded: foldForSearch(trimmed), weight, ...options };
};

const fieldsOf = (...fields: (SearchField | null)[]): SearchField[] =>
    fields.filter((entry): entry is SearchField => entry !== null);

/** A member's name as the roster spells it, from whatever casing a record used. */
const rosterName = (name: string): string =>
    getTeamMemberByName(name)?.name ?? name.charAt(0).toUpperCase() + name.slice(1);

/** `2026-09-04` → `Sep 2026`, for meta lines that only need the month. */
const formatMonthShort = (date: Date): string =>
    date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const toDay = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const plural = (count: number, one: string, many = `${one}s`) =>
    `${count} ${count === 1 ? one : many}`;

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** The site's top-level pages, so the search doubles as a way to get around. */
export const SEARCH_PAGES: {
    key: string;
    title: string;
    href: string;
    about: string;
    keywords: string;
}[] = [
    {
        key: 'home',
        title: 'Home',
        href: '/',
        about: 'Up next and the latest from the club',
        keywords: 'start front up next selection committee',
    },
    {
        key: 'films',
        title: 'Films',
        href: '/films',
        about: 'Every film the club has watched',
        keywords: 'catalog catalogue all movies screenings',
    },
    {
        key: 'log',
        title: 'Log',
        href: '/log',
        about: 'Everything the club has done, newest first',
        keywords: 'activity wall timeline feed recent history',
    },
    {
        key: 'almanac',
        title: 'Almanac',
        href: '/almanac',
        about: 'Charts, records, and statistics',
        keywords: 'stats statistics charts numbers data records',
    },
    {
        key: 'retrospective',
        title: 'Retrospective',
        href: '/retrospective',
        about: 'The year in review',
        keywords: 'year review wrapped recap annual',
    },
    {
        key: 'about',
        title: 'About',
        href: '/about',
        about: 'The club and its members',
        keywords: 'club members who team',
    },
];

const pageDocs = (): SearchDoc[] =>
    SEARCH_PAGES.map((page) => ({
        result: {
            id: `page-${page.key}`,
            group: 'page',
            title: page.title,
            meta: [page.about],
            thumb: { kind: 'icon', key: page.key },
            href: page.href,
        },
        fields: fieldsOf(field(page.title, 10), field(page.keywords, 4), field(page.about, 2)),
    }));

// ---------------------------------------------------------------------------
// Films
// ---------------------------------------------------------------------------

const filmDocs = (films: Film[]): SearchDoc[] =>
    films.map((film) => {
        const info = film.movieClubInfo;
        const watched = parseWatchDate(info?.watchDate);
        const average = calculateClubAverage(info?.clubRatings);
        const selector = info?.selector?.trim() ? rosterName(info.selector.trim()) : null;
        const cast = [
            ...new Set([
                ...(film.cast ?? []).map((member) => member.name),
                ...(film.actors ?? '').split(','),
            ]),
        ]
            .map((name) => name.trim())
            .filter(Boolean)
            .join(', ');

        const pick = selector
            ? `${selector}'s pick`
            : film.holidayPod
              ? 'Holiday pod'
              : film.popcornPod
                ? 'Popcorn pod'
                : null;

        return {
            result: {
                id: `film-${film.imdbID}`,
                group: 'film',
                title: film.title,
                titleSuffix: film.year || null,
                badge: watched ? null : 'Up next',
                meta: [
                    film.director && film.director !== 'N/A' ? `Dir. ${film.director}` : null,
                    pick,
                    watched ? `Watched ${formatMonthShort(watched)}` : null,
                ].filter((part): part is string => !!part),
                thumb: { kind: 'poster', src: film.poster || null },
                score:
                    average === null
                        ? null
                        : { value: average.toFixed(1), numeric: average, label: 'Club avg' },
                href: `/films/${film.imdbID}`,
                date: toDay(watched),
            },
            fields: fieldsOf(
                field(film.title, 10),
                field(film.year, 3),
                field(film.director, 6, { label: 'Directed by', list: true }),
                field(selector, 5, { label: 'Picked by' }),
                field(cast, 4, { label: 'Starring', list: true }),
                field(film.writer, 3, { label: 'Written by', list: true }),
                field(film.cinematographer, 2, { label: 'Shot by', list: true }),
                field(film.musicComposer, 2, { label: 'Music by', list: true }),
                field(film.genre, 3, { label: 'Genre', list: true }),
                field((film.keywords ?? []).join(', '), 2, { label: 'Keywords', list: true }),
                field(film.country, 1.5, { label: 'Country', list: true }),
                field(film.tagline, 1.5, { label: 'Tagline', prose: true }),
                field(film.plot, 1, { label: 'Plot', prose: true })
            ),
        };
    });

/** Every review written on a club film, at the screening or after it. */
const clubReviewDocs = (films: Film[]): SearchDoc[] =>
    films.flatMap((film) => {
        const watched = parseWatchDate(film.movieClubInfo?.watchDate);
        return (film.movieClubInfo?.clubRatings ?? [])
            .filter((rating) => rating.blurb?.trim())
            .map((rating) => {
                const member = rosterName(rating.user);
                const score = formatWatchedScore({
                    score: rating.score,
                    scoreQualifier: rating.scoreQualifier ?? null,
                });
                return {
                    result: {
                        id: `review-${film.imdbID}-${rating.user.toLowerCase()}`,
                        group: 'review' as const,
                        title: `${member} on ${film.title}`,
                        meta: ['Club review', watched ? formatMonthShort(watched) : null].filter(
                            (part): part is string => !!part
                        ),
                        thumb: { kind: 'avatar' as const, name: member },
                        score:
                            score === null || rating.score === null
                                ? null
                                : { value: score, numeric: rating.score, label: 'Score' },
                        quote: rating.blurb,
                        href: `/films/${film.imdbID}`,
                        date: toDay(watched),
                    },
                    fields: fieldsOf(
                        field(rating.blurb, 4, { label: 'Review', prose: true }),
                        field(film.title, 4),
                        field(member, 4)
                    ),
                };
            });
    });

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const memberDocs = (
    members: TeamMember[],
    films: Film[],
    trophies: MemberTrophy[],
    watched: WatchedLog | null
): SearchDoc[] =>
    members.map((member) => {
        const key = member.name.toLowerCase();
        const picks = films.filter(
            (film) => film.movieClubInfo?.selector?.trim().toLowerCase() === key
        ).length;
        const awards = trophies.filter((trophy) => trophy.recipient?.toLowerCase() === key).length;
        const logEntry = watched
            ? Object.entries(watched).find(([name]) => name.toLowerCase() === key)
            : undefined;
        const logged = logEntry ? logEntry[1].length : null;

        return {
            result: {
                id: `member-${key}`,
                group: 'member',
                title: member.name,
                meta: [
                    member.title,
                    picks > 0 ? plural(picks, 'pick') : null,
                    awards > 0 ? plural(awards, 'trophy', 'trophies') : null,
                    logged ? `${logged} logged` : null,
                ].filter((part): part is string => !!part),
                thumb: { kind: 'avatar', name: member.name },
                href: `/profile/${member.name}`,
            },
            fields: fieldsOf(
                field(member.name, 10),
                field(member.title, 3, { label: 'Title' }),
                field(member.bio, 1, { label: 'Bio', prose: true })
            ),
        };
    });

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const listDocs = (lists: FilmListDefinition[]): SearchDoc[] =>
    lists.map((list) => {
        const entries = resolveListEntries(list);
        const titles = entries
            .map((entry) => entry.title)
            .filter((title): title is string => !!title);
        const owner = rosterName(list.owner);

        return {
            result: {
                id: `list-${list.id}`,
                group: 'list',
                title: list.name,
                meta: [
                    `by ${owner}`,
                    plural(list.entries.length, 'film'),
                    isRankedList(list) ? 'Ranked' : null,
                ].filter((part): part is string => !!part),
                thumb: {
                    kind: 'poster',
                    src: entries.find((entry) => entry.poster)?.poster ?? null,
                },
                href: `/lists/${list.id}`,
                date: list.createdAt?.slice(0, 10) ?? null,
            },
            fields: fieldsOf(
                field(list.name, 10),
                field(owner, 5, { label: 'By' }),
                field(titles.join(', '), 3, { label: 'Includes', list: true }),
                field(list.description, 2, { label: 'About', prose: true })
            ),
        };
    });

// ---------------------------------------------------------------------------
// Member logs
// ---------------------------------------------------------------------------

/** A film a member logged on their own, and, where they wrote one, their review. */
const logDocs = (watched: WatchedLog): SearchDoc[] =>
    Object.entries(watched).flatMap(([owner, entries]) => {
        const member = rosterName(owner);
        return entries.flatMap((raw) => {
            const entry = resolveWatchedEntry(raw);
            const title = entry.title ?? 'Unknown film';
            const score = formatWatchedScore(entry);
            const scored =
                score === null || entry.score === null
                    ? null
                    : { value: score, numeric: entry.score, label: `${member}'s` };
            const href = `${watchedPathFor(member)}#${watchedRowId(entry.imdbID)}`;
            const id = `${member.toLowerCase()}-${entry.imdbID}`;

            const docs: SearchDoc[] = [
                {
                    result: {
                        id: `log-${id}`,
                        group: 'log',
                        title,
                        titleSuffix: entry.year,
                        meta: [`Logged by ${member}`, formatWatchDate(entry.watchDate)],
                        thumb: { kind: 'poster', src: entry.poster },
                        score: scored,
                        href,
                        date: entry.watchDate,
                    },
                    fields: fieldsOf(
                        field(entry.title, 10),
                        field(entry.year, 3),
                        field(member, 5, { label: 'Logged by' }),
                        field(
                            (entry.details?.crew ?? []).map((person) => person.name).join(', '),
                            3,
                            { label: 'Crew', list: true }
                        ),
                        field(
                            (entry.details?.cast ?? []).map((person) => person.name).join(', '),
                            2,
                            { label: 'Starring', list: true }
                        )
                    ),
                },
            ];

            if (entry.blurb?.trim()) {
                docs.push({
                    result: {
                        id: `review-log-${id}`,
                        group: 'review',
                        title: `${member} on ${title}`,
                        meta: ['From their log', formatWatchDate(entry.watchDate)],
                        thumb: { kind: 'avatar', name: member },
                        score: scored,
                        quote: entry.blurb,
                        href,
                        date: entry.watchDate,
                    },
                    fields: fieldsOf(
                        field(entry.blurb, 4, { label: 'Review', prose: true }),
                        field(entry.title, 4),
                        field(member, 4)
                    ),
                });
            }

            return docs;
        });
    });

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------

const trophyDocs = (trophies: MemberTrophy[], films: Film[]): SearchDoc[] => {
    const watchedOn = new Map(
        films.map((film) => [film.imdbID, parseWatchDate(film.movieClubInfo?.watchDate)])
    );
    return trophies.map((trophy) => {
        const watched = watchedOn.get(trophy.film.imdbID) ?? null;
        return {
            result: {
                id: `trophy-${trophy.key}`,
                group: 'trophy',
                title: trophy.award,
                meta: [
                    trophy.recipient ?? 'Unattributed',
                    `for ${trophy.film.title}`,
                    watched ? formatMonthShort(watched) : null,
                ].filter((part): part is string => !!part),
                thumb: { kind: 'icon', key: `trophy:${trophy.award}` },
                quote: trophy.note,
                href: `/films/${trophy.film.imdbID}`,
                date: toDay(watched),
            },
            fields: fieldsOf(
                field(trophy.award, 10),
                field(trophy.recipient, 5, { label: 'Awarded to' }),
                field(trophy.film.title, 4, { label: 'For' }),
                field(trophy.note, 2, { label: 'Why', prose: true })
            ),
        };
    });
};

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

/**
 * Optional data overrides. Production callers pass the fetched logs and nothing
 * else; tests pass fixtures, the same contract `wallUtils` offers.
 */
export interface SearchSources {
    films?: Film[];
    members?: TeamMember[];
    lists?: FilmListDefinition[];
    /** Members' logs, which are fetched rather than bundled. Null until they land. */
    watched?: WatchedLog | null;
    trophies?: MemberTrophy[];
}

export const buildSearchIndex = (sources: SearchSources = {}): SearchDoc[] => {
    const films = sources.films ?? filmData;
    const trophies = sources.trophies ?? getClubTrophies(films);
    const watched = sources.watched ?? null;
    return [
        ...pageDocs(),
        ...filmDocs(films),
        ...memberDocs(sources.members ?? teamMembers, films, trophies, watched),
        ...listDocs(sources.lists ?? filmLists),
        ...(watched ? logDocs(watched) : []),
        ...clubReviewDocs(films),
        ...trophyDocs(trophies, films),
    ];
};

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export const SEARCH_GROUPS: { key: SearchGroupKey; label: string; weight: number }[] = [
    // The weight nudges a group's hits up or down against the others'. Members
    // are few and a name is nearly always what the reader meant; a review
    // matching a film's title is a lesser answer than the film itself.
    { key: 'member', label: 'Members', weight: 1.25 },
    { key: 'film', label: 'Club films', weight: 1.15 },
    { key: 'list', label: 'Lists', weight: 1 },
    { key: 'page', label: 'Pages', weight: 1 },
    { key: 'log', label: 'Logged films', weight: 0.9 },
    { key: 'trophy', label: 'Trophies', weight: 0.9 },
    { key: 'review', label: 'Reviews', weight: 0.8 },
];

const GROUP_WEIGHT = new Map(SEARCH_GROUPS.map((group) => [group.key, group.weight]));

/** A query shorter than this doesn't reach into prose fields. */
const PROSE_MIN_LENGTH = 3;

/** How much of a long passage to show around a match, either side. */
const SNIPPET_RADIUS = 70;

export interface RankedResult extends SearchResult {
    rank: number;
    /**
     * Why it's here, when the reason isn't its title: the field that matched
     * and the part of it that did. Null when the title explains itself.
     */
    context: { label: string; text: string } | null;
}

export interface SearchGroupResults {
    key: SearchGroupKey;
    label: string;
    results: RankedResult[];
}

export const queryWords = (query: string): string[] =>
    foldForSearch(query).split(/\s+/).filter(Boolean);

/** Below this, a word has to start a word to match: "al" finds Almanac, not Natalie. */
const MID_WORD_MIN_LENGTH = 3;

/** How well one word sits in one folded string: at its start, a word's, or anywhere. */
const placement = (folded: string, word: string): number => {
    const index = folded.indexOf(word);
    if (index < 0) return 0;
    if (index === 0) return 1;
    // A word boundary anywhere it occurs, not only at the first occurrence.
    for (let at = index; at >= 0; at = folded.indexOf(word, at + 1)) {
        if (at === 0 || !/[a-z0-9]/.test(folded[at - 1])) return 0.8;
    }
    return word.length < MID_WORD_MIN_LENGTH ? 0 : 0.45;
};

/**
 * The part of a field worth showing: the matching items of a list, or a window
 * of prose around the first match. Falls back to the field's head.
 */
const snippetOf = (target: SearchField, words: string[]): string => {
    if (target.list) {
        const items = target.text.split(',').map((item) => item.trim());
        const hits = items.filter((item) => {
            const folded = foldForSearch(item);
            return words.some((word) => folded.includes(word));
        });
        return (hits.length > 0 ? hits : items).slice(0, 3).join(', ');
    }

    const text = target.text.replace(/\s+/g, ' ');
    if (text.length <= SNIPPET_RADIUS * 2) return text;

    const folded = foldForSearch(text);
    // Folding can change a string's length (a ligature, a dotted capital I), in
    // which case the index no longer lines up; the head is the safe answer then.
    const aligned = folded.length === text.length;
    const index = aligned
        ? Math.min(...words.map((word) => folded.indexOf(word)).filter((at) => at >= 0))
        : 0;
    if (!Number.isFinite(index) || index < SNIPPET_RADIUS) {
        return `${text.slice(0, SNIPPET_RADIUS * 2).trimEnd()}…`;
    }

    // Started at a word boundary, so a snippet doesn't open mid-word.
    let start = index - SNIPPET_RADIUS;
    const space = text.indexOf(' ', start);
    if (space > -1 && space < index) start = space + 1;
    const end = Math.min(text.length, index + SNIPPET_RADIUS);
    return `…${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

/** A document's rank against the query's words, or null when a word misses it. */
const rankDoc = (
    doc: SearchDoc,
    words: string[],
    phrase: string
): { rank: number; best: SearchField } | null => {
    const allowProse = phrase.length >= PROSE_MIN_LENGTH;
    let total = 0;
    let best: { field: SearchField; score: number } | null = null;

    for (const word of words) {
        let wordBest = 0;
        let wordField: SearchField | null = null;
        for (const candidate of doc.fields) {
            if (candidate.prose && !allowProse) continue;
            const score = candidate.weight * placement(candidate.folded, word);
            if (score > wordBest) {
                wordBest = score;
                wordField = candidate;
            }
        }
        if (!wordField) return null;
        total += wordBest;
        if (!best || wordBest > best.score) best = { field: wordField, score: wordBest };
    }
    if (!best) return null;

    // The whole query as one run: a title that *is* the query, or opens with
    // it, beats one that only holds each word somewhere.
    const title = doc.fields[0];
    if (title.folded === phrase) total += 12;
    else if (title.folded.startsWith(phrase)) total += 6;
    else if (words.length > 1 && title.folded.includes(phrase)) total += 3;

    return { rank: total * (GROUP_WEIGHT.get(doc.result.group) ?? 1), best: best.field };
};

/**
 * Every document the query matches, ranked, in groups — the group with the best
 * hit first, so typing a member's name leads with the member and typing a word
 * from a review leads with the review. Ties within a group go to the more
 * recent record.
 */
export const searchIndex = (docs: SearchDoc[], query: string): SearchGroupResults[] => {
    const words = queryWords(query);
    if (words.length === 0) return [];
    const phrase = words.join(' ');

    const byGroup = new Map<SearchGroupKey, RankedResult[]>();
    for (const doc of docs) {
        const ranked = rankDoc(doc, words, phrase);
        if (!ranked) continue;
        const { best } = ranked;
        const snippet =
            best.label && best !== doc.fields[0] && !doc.result.quote
                ? snippetOf(best, words)
                : null;
        // No need to say why when the meta line already says it: "Gabe's pick"
        // is the reason a search for Gabe found the film.
        const folded = snippet ? foldForSearch(snippet) : '';
        const explained =
            !snippet || doc.result.meta.some((part) => foldForSearch(part).includes(folded));
        const result: RankedResult = {
            ...doc.result,
            rank: ranked.rank,
            context: explained || !best.label ? null : { label: best.label, text: snippet! },
            // A long review is cut to the part that matched.
            quote: doc.result.quote
                ? snippetOf(
                      doc.fields.find((candidate) => candidate.text === doc.result.quote) ??
                          (field(doc.result.quote, 0, { prose: true }) as SearchField),
                      words
                  )
                : doc.result.quote,
        };
        const list = byGroup.get(doc.result.group) ?? [];
        list.push(result);
        byGroup.set(doc.result.group, list);
    }

    return SEARCH_GROUPS.filter((group) => byGroup.has(group.key))
        .map((group) => ({
            key: group.key,
            label: group.label,
            results: byGroup
                .get(group.key)!
                .sort((a, b) => b.rank - a.rank || (b.date ?? '').localeCompare(a.date ?? '')),
        }))
        .sort((a, b) => b.results[0].rank - a.results[0].rank);
};

/**
 * What the search shows before anything is typed: where to go, and what the
 * club has watched lately.
 */
export const searchSuggestions = (docs: SearchDoc[]): SearchGroupResults[] => {
    const asRanked = (result: SearchResult): RankedResult => ({
        ...result,
        rank: 0,
        context: null,
    });

    const upcoming = docs.filter((doc) => doc.result.group === 'film' && !doc.result.date);
    const recent = docs
        .filter((doc) => doc.result.group === 'film' && doc.result.date)
        .sort((a, b) => (b.result.date ?? '').localeCompare(a.result.date ?? ''));

    return [
        {
            key: 'film' as const,
            label: 'Recent screenings',
            results: [...upcoming.slice(0, 1), ...recent.slice(0, 4)].map((doc) =>
                asRanked(doc.result)
            ),
        },
        {
            key: 'page' as const,
            label: 'Jump to',
            results: docs
                .filter((doc) => doc.result.group === 'page')
                .map((doc) => asRanked(doc.result)),
        },
    ].filter((group) => group.results.length > 0);
};

/**
 * Splits a string into the runs the query's words matched and the runs between,
 * for highlighting. Falls back to one unmatched run when folding has changed the
 * string's length and the indexes no longer line up.
 */
export const highlightRuns = (
    text: string,
    words: string[]
): { text: string; match: boolean }[] => {
    const folded = foldForSearch(text);
    if (words.length === 0 || folded.length !== text.length) return [{ text, match: false }];

    const marked = new Array<boolean>(text.length).fill(false);
    for (const word of words) {
        for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + 1)) {
            marked.fill(true, at, at + word.length);
        }
    }

    const runs: { text: string; match: boolean }[] = [];
    for (let index = 0; index < text.length; index += 1) {
        const last = runs[runs.length - 1];
        if (last && last.match === marked[index]) last.text += text[index];
        else runs.push({ text: text[index], match: marked[index] });
    }
    return runs;
};
