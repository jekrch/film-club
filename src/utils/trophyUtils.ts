import type { Film } from '../types/film';
import { teamMembers } from '../types/team';
import { getBundledTrophies, type Trophy } from '../types/trophy';

/**
 * The club's awards, from both of the places they are written.
 *
 * There are two, and there will go on being two. The Google Sheet has a
 * `trophyNotes` cell per film holding a sentence a member typed years ago
 * ("Joey gets both togetherness and bad boy, Andy gets reframer trophy"), and
 * `trophies.json` holds the ones given on the site, where the recipient is a
 * field rather than a name buried in prose. Nothing migrates the first into the
 * second: the sheet is still the club's own record, and rewriting someone's
 * phrasing to fit a schema would lose the joke.
 *
 * So this module resolves both into one {@link ResolvedTrophy} shape and every
 * surface reads that. The parsing of the sheet's prose is the old regex work the
 * two galleries each did privately, moved somewhere it can be tested and where
 * the film page and the profile shelf cannot disagree about what an award is
 * called.
 */

/** One award, however it was recorded. */
export interface ResolvedTrophy {
    /** Unique within a film. The worker's `id` for a site award; positional for a sheet one. */
    key: string;
    /**
     * The member it went to, in `club.json` casing — or null when the sheet's
     * sentence named nobody the club recognizes, which is rare and which the
     * galleries render as an unattributed award rather than dropping.
     */
    recipient: string | null;
    /** What the award is called, with the recipient and any connector taken out. */
    award: string;
    /** Why it was given, when that was recorded apart from the name. Sheet awards have none. */
    note: string | null;
    /** Where it came from. Only a `club` award can be edited on the site. */
    source: 'club' | 'sheet';
    /** The worker's row id. Present exactly when `source` is `club`. */
    id?: string;
    /** Who handed it out, and therefore who may change it. `club` awards only. */
    awardedBy?: string;
}

/**
 * Connectors between a name and the award in the sheet's prose — "Andy *gets a*
 * Special Connection Award". Stripped so the award name groups with the same one
 * written any other way, which is what the profile shelf counts by.
 */
const CONNECTOR =
    /^(?:gets|got|receives|received|wins|won|takes|is awarded|awarded)\s+(?:a|an|the)?\s*/i;

/** Leftover punctuation once the name and connector are out: "Togetherness Trophy: " → "". */
const EDGE_PUNCTUATION = /^[\s,:;–—-]+|[\s,:;–—-]+$/g;

const capitalize = (value: string): string =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

/**
 * Finds the club member a sheet trophy names, and where in the text they are.
 *
 * The first name to appear wins, which matters for the handful of entries that
 * mention two people ("Andy gets a Special Connection Award for his
 * Parajanov-Vartanov award"): the subject of the sentence is the recipient, and
 * in every entry the club has written the subject comes first.
 */
function findRecipient(text: string): { name: string; start: number; end: number } | null {
    let found: { name: string; start: number; end: number } | null = null;

    teamMembers.forEach((member) => {
        if (!member.name) return;
        // Word-bounded so "Andy" doesn't match inside a title, and case-insensitive
        // because the sheet's prose capitalizes as prose does.
        const match = new RegExp(`\\b${member.name}\\b`, 'i').exec(text);
        if (match && (found === null || match.index < found.start)) {
            found = { name: member.name, start: match.index, end: match.index + match[0].length };
        }
    });

    return found;
}

/**
 * Parses one film's `trophyNotes` cell into awards.
 *
 * Comma-separated, one award per part — which is the convention the club has
 * used from the start and the reason a comma has never appeared inside an award
 * name. A part naming no member still yields an award, since the text is what
 * the club wrote and dropping it would silently lose a trophy.
 */
export function parseTrophyNotes(notes: string): ResolvedTrophy[] {
    return notes
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map((part, index) => {
            const found = findRecipient(part);
            const key = `sheet-${index}`;

            if (!found) {
                return {
                    key,
                    recipient: null,
                    award: capitalize(part),
                    note: null,
                    source: 'sheet' as const,
                };
            }

            const award = (part.slice(0, found.start) + part.slice(found.end))
                .replace(/\s+/g, ' ')
                .replace(EDGE_PUNCTUATION, '')
                .replace(CONNECTOR, '')
                .replace(EDGE_PUNCTUATION, '');

            return {
                key,
                recipient: found.name,
                // A part that was nothing but a name leaves no award to show;
                // the original text is a better answer than an empty row.
                award: capitalize(award.length >= 3 ? award : part),
                note: null,
                source: 'sheet' as const,
            };
        });
}

/**
 * Oldest award first, ties broken on `id`.
 *
 * Duplicated from the worker's `sortTrophies` rather than shared, for the same
 * reason the types are: the worker deploys on its own and has no build-time link
 * to this bundle. The site sorts anyway instead of trusting file order — an
 * award given a minute ago arrives from the API, not from the bundle, and has to
 * land in the right place on a page that is already rendered.
 */
export const compareTrophies = (a: Trophy, b: Trophy): number =>
    a.awardedAt === b.awardedAt ? a.id.localeCompare(b.id) : a.awardedAt.localeCompare(b.awardedAt);

/** One site award, in the shape the galleries render. */
function resolveStored(trophy: Trophy): ResolvedTrophy {
    return {
        key: trophy.id,
        recipient: trophy.recipient,
        award: trophy.award,
        note: trophy.note,
        source: 'club',
        id: trophy.id,
        awardedBy: trophy.awardedBy,
    };
}

/**
 * Every award on one film: the sheet's, then the site's.
 *
 * `stored` is this film's row of `trophies.json`. Callers that have the live
 * copy — a signed-in member, whose session read it from `main` — pass it, since
 * it is fresher than the bundle for the minute between a save and the deploy
 * that bakes it in. Omitted, the bundled awards are used, which is what a
 * visitor sees and what the page would have read on its own.
 */
export function resolveFilmTrophies(film: Film, stored?: Trophy[]): ResolvedTrophy[] {
    const notes = film.movieClubInfo?.trophyNotes;
    const awards = stored ?? getBundledTrophies(film.imdbID);

    return [...(notes ? parseTrophyNotes(notes) : []), ...awards.map(resolveStored)];
}

/** One member's award, with the film it was given for. */
export interface MemberTrophy extends ResolvedTrophy {
    film: Pick<Film, 'imdbID' | 'title' | 'year' | 'poster'>;
}

/** Awards of one kind, and every film this member won it for. */
export interface TrophyGroup {
    /** The award's name, in the casing of its first appearance. */
    award: string;
    trophies: MemberTrophy[];
}

/**
 * Every award one member holds, with the film each was given for.
 *
 * Matching is on `recipient` rather than on the text, which is the whole point
 * of the structured file — but sheet awards are matched the same way here
 * because {@link parseTrophyNotes} has already resolved their prose to a name.
 *
 * `live` is the whole of `trophies.json` as read from `main`. A film missing
 * from it has no site awards, which is why it isn't merged with the bundle
 * per-film: the live copy is the same file, later, not a patch on it.
 */
export function getMemberTrophies(
    films: Film[],
    memberName: string,
    live?: Record<string, Trophy[]>
): MemberTrophy[] {
    const wanted = memberName.trim().toLowerCase();

    return films.flatMap((film) =>
        resolveFilmTrophies(film, live ? (live[film.imdbID] ?? []) : undefined)
            .filter((trophy) => trophy.recipient?.toLowerCase() === wanted)
            .map((trophy) => ({
                ...trophy,
                // A sheet award's key is only unique within its film ("sheet-0"),
                // and a shelf draws awards from many films side by side — so it
                // is qualified here, where the film is known.
                key: `${film.imdbID}-${trophy.key}`,
                film: {
                    imdbID: film.imdbID,
                    title: film.title,
                    year: film.year,
                    poster: film.poster,
                },
            }))
    );
}

/**
 * Groups a member's awards by what they are called, most-won first.
 *
 * Grouping is case-insensitive so "togetherness trophy" from the sheet and
 * "Togetherness Trophy" typed on the site land on one shelf — which is the
 * behavior the profile has always had, now that both writers feed it. The
 * displayed name is the first spelling encountered.
 */
export function groupTrophies(trophies: MemberTrophy[]): TrophyGroup[] {
    const groups = new Map<string, TrophyGroup>();

    trophies.forEach((trophy) => {
        const key = trophy.award.toLowerCase();
        const existing = groups.get(key);
        if (existing) existing.trophies.push(trophy);
        else groups.set(key, { award: trophy.award, trophies: [trophy] });
    });

    return [...groups.values()].sort((a, b) => b.trophies.length - a.trophies.length);
}
