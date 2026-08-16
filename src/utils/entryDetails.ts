import type { Film } from '../types/film';
import type { ListCastMember, ListFilmSummary } from '../types/list';
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
    /** Top-billed, in TMDb's order. Empty when nothing knows the cast. */
    cast: ListCastMember[];
}

/** True when there is enough here to be worth an expander on the row. */
const hasAnything = (details: EntryDetails): boolean =>
    details.tagline !== null || details.plot !== null || details.cast.length > 0;

const orNull = (value: string | null | undefined): string | null => {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
};

/**
 * A club film's own record, with its cast mapped to the cache film's shape.
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
        cast: (film.cast ?? []).map((member) => ({
            name: member.name,
            character: member.character ?? null,
            profileUrl: member.profileUrl ?? null,
            tmdbId:
                own[normalizePersonName(member.name)]?.tmdbId ??
                getPersonProfileByName(member.name)?.tmdbId ??
                null,
        })),
    };
    return hasAnything(details) ? details : null;
};

/** The same, from a cache film, whose fields are already in this shape. */
export const summaryDetails = (summary: ListFilmSummary): EntryDetails | null => {
    const details: EntryDetails = {
        tagline: orNull(summary.tagline),
        plot: orNull(summary.plot),
        cast: summary.cast ?? [],
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
