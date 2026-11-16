import type { Film } from '../../../types/film';
import type { TeamMember } from '../../../types/team';
import { memberSlug } from '../../../types/watched';
import { memberChartColor } from '../../../utils/chartTheme';

/** The slides' small formatting helpers, kept apart from components for fast refresh. */

const WORDS = [
    'no',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
];

/** "four", "eleven", "23": words to twelve, as prose spells them. */
export const numberWord = (n: number): string => WORDS[n] ?? String(n);

/** Whole hours, for a sentence. */
export const hoursOf = (minutes: number): number => Math.round(minutes / 60);

/** A member's own colour, the one their name carries everywhere else. */
export const memberColor = (member: TeamMember, index = 0): string =>
    memberChartColor(member.color, index);

export const retrospectivePath = (year: number, member?: string): string =>
    member ? `/retrospective/${year}/${memberSlug(member)}` : `/retrospective/${year}`;

/**
 * How wide a calendar's posters may be, by its fullest month's count: the
 * fuller the fullest month, the narrower every poster, so the tallest stack
 * still sits comfortably on a phone or a laptop. A poster otherwise fills its
 * month's column.
 */
export const calendarPosterWidth = (densest: number): string =>
    densest >= 4 ? 'max-w-8' : densest === 3 ? 'max-w-9' : 'max-w-11';

/**
 * This year's club films against the years before, in one sentence: a first
 * year, a most-in-years, a change from last year. A year still running is never
 * "down" — it has the rest of its months to go.
 */
export const yearOnYear = (
    history: { year: number; withClub: number }[],
    inProgress: boolean
): string | null => {
    if (!history.length) return null;
    const { year, withClub: now } = history[history.length - 1];
    const before = history.slice(0, -1);
    if (!before.length) return 'Your first year with the club.';
    // Their last year with films, which needn't be the one before: a year
    // they missed isn't in the history.
    const { year: lastYear, withClub: last } = before[before.length - 1];
    if (now > last) {
        // A most-since only means something with a few years behind it; two
        // years back is just "up from last year" said grandly.
        const since = [...before].reverse().find((h) => h.withClub >= now);
        if (!since && before.length > 1) return 'Your most in any year with the club.';
        if (since && since.year < year - 2) return `Your most since ${since.year}.`;
        return `Up from ${last} in ${lastYear}.`;
    }
    if (now === last) return `The same as in ${lastYear}.`;
    return inProgress
        ? `${numberWord(last - now)} more to match ${lastYear}.`.replace(/^./, (c) =>
              c.toUpperCase()
          )
        : `Down from ${last} in ${lastYear}.`;
};

/** "1.5" stays, "7.0" reads "7". */
export const formatScore = (score: number): string =>
    Number.isInteger(score) ? String(score) : score.toFixed(1);

export const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/** A review cut to a length a slide can carry, at a word boundary. */
export const excerpt = (text: string, limit = 280): string => {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length <= limit) return flat;
    const cut = flat.slice(0, limit);
    return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\-–—]+$/, '')}…`;
};

/** "Andy", "Andy and Gabe", "Andy, Gabe and Joey". */
export const listNames = (names: string[]): string =>
    names.length <= 1
        ? (names[0] ?? '')
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** A credited person's headshot from any of these films, if TMDb had one. */
export const headshotFor = (name: string, films: Film[]): string | null => {
    const key = name.trim().toLowerCase();
    for (const film of films) {
        const fromCast = film.cast?.find((c) => c.name?.trim().toLowerCase() === key)?.profileUrl;
        if (fromCast) return fromCast;
        const fromProfiles = film.personProfiles?.[key]?.profileUrl;
        if (fromProfiles) return fromProfiles;
    }
    return null;
};

/** "Director", "Director and Writer", "Actor, Writer and Editor". */
export const formatRoles = (roles: string[]): string => listNames(roles);

/** "Director", "Actor · as Irma Vep": the roles, and the part when they played one. */
export const formatCredit = ({
    roles,
    character,
}: {
    roles: string[];
    character?: string;
}): string => (character ? `${formatRoles(roles)} · as ${character}` : formatRoles(roles));

/**
 * The figures along the bottom of a member's closing poster: always the films,
 * then the average they gave and the trophies they won when there's anything
 * to say — a poster doesn't print a dash or a zero.
 */
export const posterFigures = (closing: {
    films: number;
    averageGiven: number | null;
    trophies: number;
}): { value: string; label: string }[] => [
    { value: String(closing.films), label: closing.films === 1 ? 'film' : 'films' },
    ...(closing.averageGiven === null
        ? []
        : [{ value: closing.averageGiven.toFixed(1), label: 'average' }]),
    ...(closing.trophies > 0
        ? [
              {
                  value: String(closing.trophies),
                  label: closing.trophies === 1 ? 'trophy' : 'trophies',
              },
          ]
        : []),
];

/** "criterion-club-2026-jacob.jpg": what a saved closing poster is called. */
export const posterFilename = (year: number, member: string): string =>
    `criterion-club-${year}-${memberSlug(member)}.jpg`;
