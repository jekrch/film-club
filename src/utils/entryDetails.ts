import type { Film, Rating } from '../types/film';
import type { ListCrewMember, ListFilmSummary } from '../types/list';
import { getFilmBackdrops } from './filmUtils';
import { getPersonProfileByName, normalizePersonName } from './personUtils';

/**
 * What a row can show about the film itself, as opposed to what its owner said
 * about it.
 *
 * A list row and a watch-log row are the two places on this site where a member
 * meets a film they know nothing about — most of what is on them are films the
 * club never watched, which have no page here and only ever showed a title and a
 * poster. This is the shape behind the panel that fixes that, and it is
 * deliberately the same shape whichever side of the club divide the film falls
 * on: `films.json` and the summary cache name these fields identically, so the
 * panel is written once.
 *
 * It carries nothing a member wrote. Their note, their score, and their own
 * artwork are resolved separately and stay separate — this is the film, that is
 * the row.
 */
export interface EntryDetails {
    tagline: string | null;
    plot: string | null;
    /**
     * Direction, writing and photography as person cards, in reading order and
     * one card per person however many jobs they held. Built here rather than in
     * the panel so the order and the grouping are one decision in one place.
     */
    crew: EntryPerson[];
    /** IMDb, Rotten Tomatoes, Metacritic — whichever the source had. */
    ratings: Rating[];
    /** Wide scene art, for the strip that opens them in a lightbox. */
    stills: string[];
    /** Top-billed, in TMDb's order. Empty when nothing knows the cast. */
    cast: EntryPerson[];
}

/**
 * One person on a film, as either strip draws them: a face, a name that may
 * link, and what they did.
 *
 * Cast and crew share the shape because the card is the same object either way
 * — only the subtitle differs, a character in one and a job in the other.
 */
export interface EntryPerson {
    name: string;
    /** Their part or their job(s); null when the source credits neither. */
    role: string | null;
    profileUrl: string | null;
    /** Their TMDb page, when there is one to link to. */
    tmdbId: number | null;
}

/** TMDb's job strings, as a row says them. Anything else is shown verbatim. */
const CREW_JOB_LABELS: Record<string, string> = {
    'Director of Photography': 'Cinematography',
};

const crewLabel = (job: string | null | undefined): string | null => {
    const text = orNull(job);
    return text === null ? null : (CREW_JOB_LABELS[text] ?? text);
};

/**
 * Crew as cards, one per person, roles joined when someone held more than one.
 *
 * A film's writer-director is one person and gets one face; listing them twice
 * is the kind of thing a reader notices and no one intends. The club film page
 * groups its crew strip the same way, for the same reason.
 */
const crewPeople = (crew: ListCrewMember[]): EntryPerson[] => {
    const byName = new Map<string, EntryPerson & { roles: string[] }>();

    for (const member of crew) {
        if (!member.name) continue;
        const key = normalizePersonName(member.name);
        const label = crewLabel(member.job);
        const existing = byName.get(key);

        if (existing) {
            if (label && !existing.roles.includes(label)) existing.roles.push(label);
            // A second credit may carry the headshot the first one lacked.
            existing.profileUrl ??= member.profileUrl ?? null;
            existing.tmdbId ??= member.tmdbId ?? null;
            continue;
        }

        byName.set(key, {
            name: member.name,
            role: null,
            profileUrl: member.profileUrl ?? null,
            tmdbId: member.tmdbId ?? null,
            roles: label ? [label] : [],
        });
    }

    return [...byName.values()].map(({ roles, ...person }) => ({
        ...person,
        role: roles.length > 0 ? roles.join(' · ') : null,
    }));
};

/**
 * The fallback when nothing has a structured crew: OMDB's comma-separated
 * strings, which are names and nothing else.
 *
 * A film CI hasn't reached yet still says who directed it — without a face or a
 * link, because OMDB supplies neither.
 */
const NAMED_CREDITS: { label: string; key: 'director' | 'writer' }[] = [
    { label: 'Director', key: 'director' },
    { label: 'Writer', key: 'writer' },
];

const crewFromNames = (
    source: Partial<Record<'director' | 'writer', string | null | undefined>>
): EntryPerson[] =>
    crewPeople(
        NAMED_CREDITS.flatMap(({ label, key }) =>
            (orNull(source[key]) ?? '')
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name, job: label }))
        )
    );

/** True when there is enough here to be worth an expander on the row. */
const hasAnything = (details: EntryDetails): boolean =>
    details.tagline !== null ||
    details.plot !== null ||
    details.cast.length > 0 ||
    details.crew.length > 0 ||
    details.ratings.length > 0 ||
    details.stills.length > 0;

const orNull = (value: string | null | undefined): string | null => {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
};

/**
 * A club film keeps its person ids in a per-film `personProfiles` map keyed by
 * normalized name, because the club's own person modal is name-keyed. A card
 * wants the id and the headshot per person and doesn't care where they came
 * from; these two resolve them, preferring the film's own map to the global
 * index merged across every club film — both answer the same for a bundled
 * film, but the film's own is direct and still works for one that isn't.
 */
const tmdbIdFor = (name: string, own: Record<string, { tmdbId: number }>): number | null =>
    own[normalizePersonName(name)]?.tmdbId ?? getPersonProfileByName(name)?.tmdbId ?? null;

const profileUrlFor = (
    name: string,
    own: Record<string, { profileUrl?: string | null }>
): string | null =>
    own[normalizePersonName(name)]?.profileUrl ??
    getPersonProfileByName(name)?.profileUrl ??
    null;

/**
 * A club film's own record, with its cast and crew mapped to the card shape.
 *
 * The mapping exists for one field: `tmdbId`. Club films keep their person ids
 * in a separate per-film `personProfiles` map keyed by normalized name, because
 * the club's own person modal is name-keyed; the panel wants an id per actor and
 * doesn't care where it came from. A name that doesn't resolve simply isn't a
 * link.
 *
 * The film's own map is consulted before the global name index. Both answer the
 * same for a bundled film — the index is built out of these maps — but the
 * film's own is the direct answer rather than one merged across every club film,
 * and it still resolves for a film that isn't in the bundle.
 */
export const clubFilmDetails = (film: Film): EntryDetails | null => {
    const own = film.personProfiles ?? {};
    const details: EntryDetails = {
        tagline: orNull(film.tagline),
        plot: orNull(film.plot),
        // A club film has no structured crew — its credits are the sheet's
        // comma-separated strings — so its cards come from the name path, with
        // the TMDb ids resolved below the same way the cast's are.
        crew: crewFromNames(film).map((person) => ({
            ...person,
            tmdbId: person.tmdbId ?? tmdbIdFor(person.name, own),
            profileUrl: person.profileUrl ?? profileUrlFor(person.name, own),
        })),
        ratings: film.ratings ?? [],
        // A club film's curated `backdropImage` leads its stills, which is the
        // same order the film's own page shows them in.
        stills: getFilmBackdrops(film),
        cast: (film.cast ?? []).map((member) => ({
            name: member.name,
            role: member.character ?? null,
            profileUrl: member.profileUrl ?? profileUrlFor(member.name, own),
            tmdbId: tmdbIdFor(member.name, own),
        })),
    };
    return hasAnything(details) ? details : null;
};

/** The same, from a cache film, whose fields are already in this shape. */
export const summaryDetails = (summary: ListFilmSummary): EntryDetails | null => {
    const details: EntryDetails = {
        tagline: orNull(summary.tagline),
        plot: orNull(summary.plot),
        // TMDb's crew when CI has fetched it, OMDB's bare names until then.
        crew: summary.crew?.length ? crewPeople(summary.crew) : crewFromNames(summary),
        ratings: summary.ratings ?? [],
        stills: summary.backdropImages ?? [],
        cast: (summary.cast ?? []).map((member) => ({
            name: member.name,
            role: member.character ?? null,
            profileUrl: member.profileUrl ?? null,
            tmdbId: member.tmdbId ?? null,
        })),
    };
    return hasAnything(details) ? details : null;
};

/**
 * The details a row shows, from whichever record it resolved against. Null when
 * neither knows anything worth expanding — a film added minutes ago, or one CI
 * asked TMDb about and got nothing for.
 */
export const resolveEntryDetails = (
    clubFilm: Film | undefined,
    summary: ListFilmSummary | undefined
): EntryDetails | null => {
    if (clubFilm) return clubFilmDetails(clubFilm);
    return summary ? summaryDetails(summary) : null;
};
