import {
    CLUB_YEARS,
    DEFAULT_WELCOME,
    FEATURED_CLUB_REVIEWS,
    WORDS_NEVER_FIRST,
    WELCOMES,
} from '../config/retrospective';
import { findFilmSummary } from '../api/filmSummaries';
import type { ClubRating, Film } from '../types/film';
import type { FilmListDefinition, ListFilmSummary } from '../types/list';
import {
    clubThreadId,
    listThreadId,
    logThreadId,
    reviewThreadId,
    type ReactionKey,
    type ResponsesFile,
} from '../types/responses';
import { capitalizeUserName, type TeamMember } from '../types/team';
import type { Trophy } from '../types/trophy';
import type { WatchedEntry, WatchedLog } from '../types/watched';
import {
    categoryCounts,
    categoryValuesOf,
    decadeOf,
    listed,
    meetingIntervals,
    sortByWatchDate,
    type CategoryPoint,
    type FilmWithDate,
} from './almanacUtils';
import {
    getAllFilmCreditsForPerson,
    getFilmBackdrops,
    isPodFilm,
    parseWatchDate,
} from './filmUtils';
import { addedLate } from './ratingUtils';
import { calculateMemberStats, parseRuntime } from './statUtils';
import { getClubTrophies, groupByRecipient, groupTrophies, type MemberTrophy } from './trophyUtils';

/**
 * The retrospective: one year of the club, and of each member, as plain data.
 *
 * Every figure is computed from files the site already has, and wherever an
 * existing util computes a figure it is called here with the year's films
 * rather than reimplemented — so a number on a slide is the number the almanac
 * or the profile shows for the same films.
 *
 * **What counts in a year.** A club film counts in the year of its
 * `movieClubInfo.watchDate`; a log entry in the year of its own `watchDate`; a
 * site trophy, list or comment by when it was recorded. A sheet trophy has no
 * date but its film's. A reaction has no date at all, so it counts in the year
 * of what it was left on — the screening, the log entry, the review, the list.
 *
 * **The club/personal divide.** The sources keep `films` and `watched` apart,
 * and so do the outputs: a member's count is two figures, not a total with a
 * flag, and no log entry is ever handed to a function that takes `Film`. The
 * two meet only in a member's taste and director, through {@link TasteInput},
 * which both are mapped *into* — the same move `FrameSource` makes for art.
 *
 * **Empty is null.** Each field of a report is one slide, and a slide with
 * nothing to say for that year is null rather than a zero. The page renders the
 * non-null ones in order, so "omit empty slides" is a filter.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface RetrospectiveSources {
    /** `filmData`, unfiltered — the builders filter by year. */
    films: Film[];
    /** Every member's log, from `useWatchedLog(ALL_MEMBERS)`. */
    watched: WatchedLog;
    /** Summaries for logged films that aren't club films. */
    summaries: Record<string, ListFilmSummary>;
    /** `trophies.json`'s `films` map, live where the page has it. */
    trophies: Record<string, Trophy[]>;
    responses: ResponsesFile;
    lists: FilmListDefinition[];
    members: TeamMember[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

/** A club film with one member's score on it. */
export interface MemberScore {
    film: Film;
    score: number;
}

/** A logged film, resolved for display. Its own shape — never a `Film`. */
export interface LoggedFilm {
    /** The log's owner, in `club.json` casing. */
    member: string;
    entry: WatchedEntry;
    imdbID: string;
    /** Null when neither cache knows the film. */
    title: string | null;
    year: string | null;
    poster: string | null;
    runtime: string | null;
    genre: string | null;
    director: string | null;
    /** Scene art, from the summary cache or, for a club film, its own stills. */
    stills: string[];
    /** True when the id is also a club film, so the slide can link to its page. */
    isClubFilm: boolean;
}

/** A review, club or personal. */
export interface RetrospectiveReview {
    source: 'club' | 'log';
    member: string;
    imdbID: string;
    title: string;
    poster: string | null;
    blurb: string;
    words: number;
    score: number | null;
    threadId: string;
    reactions: number;
    /** Set only on a voice from the future ({@link FutureReview}): when it was written. */
    writtenAt?: string;
}

/**
 * A review written in a later year by someone who joined the club after this
 * one, on one of this year's films: quoted as a voice from the future.
 */
export interface FutureReview extends RetrospectiveReview {
    writtenAt: string;
}

/** One person's work on one film, as the film's credits list it. */
export interface Credit {
    film: Film;
    /** `Director`, `Actor`, `Cinematographer`… — every role they had on it. */
    roles: string[];
    /** Who they played, when they acted and the film's cast names the part. */
    character?: string;
}

export interface MonthCount {
    /** 0–11, earliest first: every month tied for the most. */
    months: number[];
    count: number;
}

export interface Tally {
    name: string;
    count: number;
}

/** What a reaction thread hangs from, so a slide can say what drew the reactions. */
export interface ThreadSubject {
    threadId: string;
    kind: 'club' | 'log' | 'review' | 'list';
    title: string;
    member: string | null;
    imdbID: string | null;
    listId: string | null;
}

/**
 * The ways a year can stand out from the others, in the order they're tried:
 * its score first, then how much we watched, then how far afield, then the
 * rest, so every year has a fair chance at something.
 */
export type StandoutKind =
    | 'highest-score'
    | 'lowest-score'
    | 'most-films'
    | 'most-hours'
    | 'most-countries'
    | 'most-languages'
    | 'least-english'
    | 'least-american'
    | 'oldest'
    | 'agreed'
    | 'divided'
    | 'newest'
    | 'longest'
    | 'most-months';

export interface Standout {
    kind: StandoutKind;
    /** The figure in every year with one, earliest first, as the slide prints it. */
    years: { year: number; value: number }[];
    /** The closest any other year came: the figure, and every year that reached it. */
    next: { value: number; years: number[] };
    /** For a share of the year's films: how many, out of how many. */
    share: { count: number; of: number } | null;
    /** The films that make the point, the most telling first, for the stills behind the slide. */
    films: Film[];
}

export interface ClubRetrospective {
    year: number;
    /** The year isn't over yet; the slides say "so far". */
    inProgress: boolean;
    /** The year's club films, earliest first. For the cover's collage. */
    films: FilmWithDate[];

    count: {
        films: number;
        minutes: number;
        /** The year before's count, or null when the club watched nothing then. */
        previousYear: number | null;
        /**
         * The most films in a year since this year, when the count tops at
         * least the two years before: 'ever' for more than every earlier year.
         */
        mostSince: number | 'ever' | null;
        /**
         * The members' average score in each year up to this one that has
         * one, earliest first: the mean of each film's average, from those
         * with the club that year. Popcorn pods aren't in it.
         */
        averages: { year: number; average: number }[];
    } | null;

    calendar: {
        busiestMonth: MonthCount;
        /** The longest gap between two of the year's screenings. Null with one screening. */
        longestGap: { days: number; from: Film; to: Film } | null;
        first: Film;
        last: Film;
    } | null;

    /**
     * The one way the year stood out from every other year with club films:
     * the first of the standouts, in order, that it holds outright at the
     * precision the slide prints. Null when it holds none of them.
     */
    standout: Standout | null;

    places: {
        countries: CategoryPoint[];
        languages: CategoryPoint[];
        decades: CategoryPoint[];
        /** The mean release year of the films, rounded. */
        averageYear: number;
        oldest: Film;
        newest: Film;
        /** The same figures for the year before, or null when the club watched nothing then. */
        previousYear: {
            countries: number;
            /** Null when none of that year's films had a release year. */
            averageYear: number | null;
        } | null;
    } | null;

    /**
     * What each active member scored highest and lowest this year. Each member's
     * own taste, side by side — never a ranking of films or of the people who
     * picked them.
     */
    favourites:
        | {
              member: TeamMember;
              loved: MemberScore;
              /** Null when they scored only one film, or scored everything alike. */
              leastLoved: MemberScore | null;
          }[]
        | null;

    /**
     * The film the members loved most together, and least: averaged over the
     * members' own scores, so a guest's doesn't tip it. About the films — the
     * slide never says whose pick either was.
     */
    together: {
        loved: { film: Film; average: number };
        leastLoved: { film: Film; average: number } | null;
    } | null;

    /** Who picked what, in the order they were watched. No scores: a pick isn't a contest. */
    selections: { selector: string; films: Film[] }[] | null;

    trophies: {
        total: number;
        mostGiven: { award: string; count: number };
        topRecipient: { recipient: string; count: number } | null;
        trophies: MemberTrophy[];
    } | null;

    offDocket: {
        entries: number;
        byMember: Tally[];
        /**
         * Films two or more members logged off the docket, counting anyone a
         * review says the owner watched it with. Most members first; among
         * those, the ones more of them logged themselves, then earliest
         * watched. At most {@link SHARED_FILMS_SHOWN}.
         */
        sharedFilms: {
            imdbID: string;
            title: string;
            poster: string | null;
            members: string[];
        }[];
    } | null;

    words: {
        count: number;
        club: number;
        log: number;
        /** Whether anyone logged anything this year; before the log existed, nobody had. */
        hadLogs: boolean;
        longest: RetrospectiveReview;
        mostReacted: RetrospectiveReview | null;
        /**
         * A few reviews to quote, spread as evenly across the voices as they
         * go, voices from the future among them (last, with `writtenAt` set).
         */
        highlights: RetrospectiveReview[];
        /**
         * Every voice from the future on the year's films ({@link futureVoices}).
         * Not in `count`, which is the year's own writing.
         */
        future: FutureReview[];
    } | null;

    reactions: {
        total: number;
        topReaction: { key: ReactionKey; count: number };
        topThread: { subject: ThreadSubject; count: number };
    } | null;

    /**
     * Repeat artists: people credited on two or more of the year's films, each
     * with what they did on every one (and who they played, for actors) — up
     * to three, the most-credited first.
     */
    faces: { name: string; credits: Credit[] }[] | null;

    /**
     * People on this year's films whom the club had met before, on films from
     * earlier years: who they were then and who they are now. Up to three, not
     * repeating anyone in {@link faces}.
     */
    returning: { name: string; now: Credit[]; before: (Credit & { year: number })[] }[] | null;

    /**
     * Everyone with the club this year ({@link CLUB_YEARS}), past members
     * included: a year before someone joined leaves them out.
     */
    roster: TeamMember[];

    /** Those with a report of their own this year: current members on the roster. */
    reports: TeamMember[];

    /**
     * People off the roster who sat in on a screening — Greg, the intern. A
     * mention in passing; nothing else in the report counts them.
     */
    guests: { member: TeamMember; films: Film[] }[];

    /**
     * Whoever arrived this year ({@link WELCOMES}), a card each: the line that
     * greets them and the first club film they scored, when they scored one.
     */
    welcomes: { member: TeamMember; line: string; first: FilmWithDate | null }[] | null;
}

export interface MemberRetrospective {
    year: number;
    inProgress: boolean;
    member: TeamMember;
    /** What they saw this year, for the cover's collage. Two lists, never one. */
    films: { club: FilmWithDate[]; log: LoggedFilm[] };

    count: {
        withClub: number;
        onOwn: number;
        minutes: { withClub: number; onOwn: number };
        /**
         * Their club films in each year from their first through this one, gaps
         * included. Club films only: the log is too new to compare years by.
         */
        history: { year: number; withClub: number }[];
    };

    scores: {
        /** Club scores only; their log scores are {@link logAverage}. */
        average: number;
        count: number;
        /** One bar per whole point, 0 through 9; 6.5 counts toward 6. */
        distribution: { score: number; count: number }[];
        highest: MemberScore;
        lowest: MemberScore | null;
        /** Average of the scores in their own log this year, and how many there were. */
        logAverage: number | null;
        logCount: number;
    } | null;

    /** Their selections this year, in the order they were watched. */
    picks: Film[] | null;

    breakaway: { film: Film; score: number; othersAverage: number; divergence: number } | null;

    log: {
        busiestMonth: MonthCount;
        /** Most consecutive Monday-to-Sunday weeks with at least one entry. */
        longestWeekStreak: number;
        first: LoggedFilm;
        last: LoggedFilm;
        /** Films on their log this year that no other member logged and the club never watched. */
        solo: number;
    } | null;

    taste: {
        genres: Tally[];
        decades: Tally[];
        /** From club films alone: a log film's summary has no country. */
        countries: Tally[];
    } | null;

    director: {
        name: string;
        withClub: number;
        onOwn: number;
        /** Their films among the member's year, for finding a headshot. */
        imdbIDs: string[];
    } | null;

    words: {
        count: number;
        longest: RetrospectiveReview;
        mostReacted: RetrospectiveReview | null;
        highlights: RetrospectiveReview[];
        /** Whether anyone in the club logged anything this year; before the log existed, nobody had. */
        hadLogs: boolean;
    } | null;

    trophies: { received: MemberTrophy[]; given: MemberTrophy[] } | null;

    lists: FilmListDefinition[] | null;

    /** The four figures on the closing card, each present for a club-only member. */
    closing: {
        films: number;
        averageGiven: number | null;
        favourite: MemberScore | null;
        trophies: number;
    };
}

// ---------------------------------------------------------------------------
// Dating
// ---------------------------------------------------------------------------

/** The year a club film was watched, or null when it hasn't been. */
export const clubYear = (film: Film): number | null =>
    parseWatchDate(film.movieClubInfo?.watchDate)?.getUTCFullYear() ?? null;

/** The year of a log entry's `YYYY-MM-DD` watch date. */
export const logYear = (entry: WatchedEntry): number | null => {
    const year = parseInt(entry.watchDate.slice(0, 4), 10);
    return Number.isNaN(year) ? null : year;
};

/**
 * The year of a recorded instant, for the reader. Local, as the wall dates
 * instants: a list made at 9pm on New Year's Eve in Minneapolis is last year's.
 */
const instantYear = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
};

const clubFilmsIn = (films: Film[], year: number): FilmWithDate[] =>
    sortByWatchDate(films.filter((film) => clubYear(film) === year));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const validScore = (score: number | null | undefined): score is number =>
    typeof score === 'number' && !Number.isNaN(score);

/**
 * How close, in points, a score sits to another's to count as alongside it:
 * a member whose score most of the room matched this closely was with the
 * group on that film, not apart from it.
 */
const WITH_THE_GROUP = 1;

const mean = (values: number[]): number | null =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

const minutesOf = (runtimes: (string | null | undefined)[]): number =>
    runtimes.reduce((sum, runtime) => sum + (parseRuntime(runtime) ?? 0), 0);

/**
 * A member's club films per year, oldest first: each earlier year they saw
 * any, then `year` itself, even at zero, since it's the year being told.
 * Empty when they've never seen one.
 *
 * Only films watched with the club count. A score from before they joined
 * ({@link CLUB_YEARS}), or one added on the site well after the screening, is
 * a film caught up on later, and would grow bars for years they weren't there.
 */
const clubHistory = (
    films: Film[],
    name: string,
    year: number
): MemberRetrospective['count']['history'] => {
    const joined = CLUB_YEARS[name.toLowerCase()]?.joined ?? -Infinity;
    const counts = new Map<number, number>();
    films.forEach((film) => {
        const screening = parseWatchDate(film.movieClubInfo?.watchDate);
        const y = screening?.getUTCFullYear();
        if (!screening || y === undefined || y < joined || y > year) return;
        const scored = film.movieClubInfo?.clubRatings.some(
            (r) =>
                sameName(r.user, name) &&
                validScore(r.score) &&
                !addedLate(r.scoreAddedAt, screening)
        );
        if (scored) counts.set(y, (counts.get(y) ?? 0) + 1);
    });
    if (!counts.size) return [];
    if (!counts.has(year)) counts.set(year, 0);
    return [...counts.entries()]
        .sort(([a], [b]) => a - b)
        .map(([y, withClub]) => ({ year: y, withClub }));
};

/** Counts of each name, most first, ties alphabetical. */
const tally = (names: string[]): Tally[] => {
    const counts = new Map<string, number>();
    names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
    return [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** The months with the most dates in them, every one of them when they tie. */
export const busiestMonth = (months: number[]): MonthCount | null => {
    if (!months.length) return null;
    const counts = Array<number>(12).fill(0);
    months.forEach((month) => counts[month]++);
    const count = Math.max(...counts);
    return { months: counts.flatMap((c, month) => (c === count ? [month] : [])), count };
};

/** The `club.json` name for a rating's lowercase `user`, or the user capitalized. */
const displayName = (user: string, members: TeamMember[]): string =>
    members.find((m) => m.name.toLowerCase() === user.trim().toLowerCase())?.name ??
    capitalizeUserName(user);

const sameName = (a: string | null | undefined, b: string | null | undefined): boolean =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const isActive = (member: TeamMember): boolean =>
    typeof member.queue === 'number' && member.queue > 0;

/**
 * True when a member was with the club in `year`, by {@link CLUB_YEARS}. Anyone
 * without a year they left is a member only while they're on the queue.
 */
const inClubIn = (member: TeamMember, year: number): boolean => {
    const span = CLUB_YEARS[member.name.toLowerCase()] ?? {};
    if (span.left === undefined && !isActive(member)) return false;
    return year >= (span.joined ?? -Infinity) && year <= (span.left ?? Infinity);
};

/** A member's log, matched case-insensitively. */
const logOf = (watched: WatchedLog, member: string): WatchedEntry[] => {
    const key = Object.keys(watched).find((name) => sameName(name, member));
    return key === undefined ? [] : watched[key];
};

/**
 * One member's own scores on these films, highest first. The sort is stable, so
 * among equal scores the earlier screening comes first.
 */
const scoresBy = (films: Film[], name: string): MemberScore[] =>
    films
        .flatMap((film) => {
            const rating = film.movieClubInfo?.clubRatings.find((r) => sameName(r.user, name));
            return rating && validScore(rating.score) ? [{ film, score: rating.score }] : [];
        })
        .sort((a, b) => b.score - a.score);

/** Their favourite, and their least favourite when it is actually lower. */
const lovedAndLeast = (
    scores: MemberScore[]
): { loved: MemberScore; leastLoved: MemberScore | null } | null => {
    if (!scores.length) return null;
    const last = scores[scores.length - 1];
    return { loved: scores[0], leastLoved: last.score < scores[0].score ? last : null };
};

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------
// Logged films
// ---------------------------------------------------------------------------

/**
 * A log entry with what the caches know about its film. A club film's metadata
 * is read for display only, the same crossover `ResolvedWatchedEntry.clubFilm`
 * makes; the entry stays a log entry.
 */
const resolveLogged = (
    member: string,
    entry: WatchedEntry,
    sources: RetrospectiveSources,
    clubIndex: Map<string, Film>
): LoggedFilm => {
    const summary = findFilmSummary(entry.imdbID, sources.summaries);
    const club = clubIndex.get(entry.imdbID);
    return {
        member,
        entry,
        imdbID: entry.imdbID,
        title: summary?.title ?? club?.title ?? null,
        year: summary?.year ?? club?.year ?? null,
        poster: entry.posterImage || summary?.poster || club?.poster || null,
        runtime: summary?.runtime ?? club?.runtime ?? null,
        genre: summary?.genre ?? club?.genre ?? null,
        director: summary?.director ?? club?.director ?? null,
        stills: summary?.backdropImages ?? (club ? getFilmBackdrops(club) : []),
        isClubFilm: !!club,
    };
};

/** Every member's entries in the year, resolved, earliest first. */
const loggedIn = (
    year: number,
    sources: RetrospectiveSources,
    clubIndex: Map<string, Film>
): LoggedFilm[] =>
    Object.entries(sources.watched)
        .flatMap(([owner, entries]) => {
            const member = displayName(owner, sources.members);
            return entries
                .filter((entry) => logYear(entry) === year)
                .map((entry) => resolveLogged(member, entry, sources, clubIndex));
        })
        .sort(
            (a, b) =>
                a.entry.watchDate.localeCompare(b.entry.watchDate) ||
                a.imdbID.localeCompare(b.imdbID)
        );

/** Whether any member logged anything in the year: false for the years before the log. */
const anyLoggedIn = (year: number, sources: RetrospectiveSources): boolean =>
    Object.values(sources.watched).some((entries) =>
        entries.some((entry) => logYear(entry) === year)
    );

/**
 * How many entries a year needs before it can be the first off-docket year.
 * The log started late in 2025 with a single entry, which isn't enough for a
 * slide; once a year has cleared this, every later year shows whatever it has.
 */
const OFF_DOCKET_FIRST_YEAR_MIN = 4;

/** The first year with enough log entries to show off the docket, or null. */
const firstOffDocketYear = (sources: RetrospectiveSources): number | null => {
    const perYear = new Map<number, number>();
    Object.values(sources.watched).forEach((entries) =>
        entries.forEach((entry) => {
            const y = logYear(entry);
            if (y !== null) perYear.set(y, (perYear.get(y) ?? 0) + 1);
        })
    );
    const years = [...perYear].filter(([, n]) => n >= OFF_DOCKET_FIRST_YEAR_MIN).map(([y]) => y);
    return years.length ? Math.min(...years) : null;
};

/** How many films more than one member logged the off-docket slide shows. */
export const SHARED_FILMS_SHOWN = 5;

/**
 * The club members a log review says the owner watched the film with: any in
 * `club.json` named after a "with" in the same sentence, as in "saw this at the
 * Heights with Jenny and Joey". The intern counts too. The retrospective treats
 * them as having logged it as well.
 */
const companionsOf = (logged: LoggedFilm, members: TeamMember[]): string[] => {
    const blurb = logged.entry.blurb;
    if (!blurb) return [];
    const clauses = blurb
        .split(/[.!?\n]+/)
        .flatMap((sentence) => sentence.match(/\bwith\b(.*)/i)?.[1] ?? []);
    return members
        .filter((m) => !sameName(m.name, logged.member))
        .filter((m) => clauses.some((clause) => new RegExp(`\\b${m.name}\\b`).test(clause)))
        .map((m) => m.name);
};

/**
 * Who logged what in the year: every entry under its owner, and each film once
 * more for anyone its review says they watched it with, unless that member
 * logged it themselves.
 */
const offDocketLogs = (
    logged: LoggedFilm[],
    members: TeamMember[]
): { member: string; logged: LoggedFilm }[] => {
    const key = (member: string, imdbID: string) => `${member.toLowerCase()}|${imdbID}`;
    const seen = new Set(logged.map((l) => key(l.member, l.imdbID)));
    return logged.flatMap((l) => [
        { member: l.member, logged: l },
        ...companionsOf(l, members).flatMap((member) => {
            if (seen.has(key(member, l.imdbID))) return [];
            seen.add(key(member, l.imdbID));
            return [{ member, logged: l }];
        }),
    ]);
};

// ---------------------------------------------------------------------------
// Taste: where club films and log films meet
// ---------------------------------------------------------------------------

/**
 * What taste and director slides read from a film, whichever source it came
 * from. Both a `Film` and a {@link LoggedFilm} are mapped into this, so neither
 * reaches a function written for the other.
 */
interface TasteInput {
    source: 'club' | 'log';
    imdbID: string;
    genres: string[];
    decade: string | null;
    directors: string[];
    /** Club films only. */
    country: string | null;
}

const tasteOfFilm = (film: Film): TasteInput => ({
    source: 'club',
    imdbID: film.imdbID,
    genres: listed(film.genre),
    decade: decadeOf(film.year),
    directors: listed(film.director),
    country: listed(film.country)[0] ?? null,
});

const tasteOfLogged = (logged: LoggedFilm): TasteInput => ({
    source: 'log',
    imdbID: logged.imdbID,
    genres: listed(logged.genre),
    decade: decadeOf(logged.year),
    directors: listed(logged.director),
    country: null,
});

// ---------------------------------------------------------------------------
// Reviews and reactions
// ---------------------------------------------------------------------------

const reactionCount = (responses: ResponsesFile, threadId: string): number =>
    Object.values(responses.threads[threadId]?.reactions ?? {}).reduce(
        (sum, members) => sum + (members?.length ?? 0),
        0
    );

/** The earliest the site recorded a member's score or review on a club film, if it did. */
const firstAdded = (film: Film, user: string): string | null => {
    const rating = film.movieClubInfo?.clubRatings.find((r) => sameName(r.user, user));
    const stamps = [rating?.scoreAddedAt, rating?.blurbAddedAt].filter((s): s is string => !!s);
    return stamps.sort()[0] ?? null;
};

/** One club review, as the slides quote it. */
const clubReview = (
    film: Film,
    rating: ClubRating,
    blurb: string,
    sources: RetrospectiveSources
): RetrospectiveReview => {
    const member = displayName(rating.user, sources.members);
    const threadId = reviewThreadId(member, film.imdbID);
    return {
        source: 'club',
        member,
        imdbID: film.imdbID,
        title: film.title,
        poster: film.poster || null,
        blurb,
        words: wordCount(blurb),
        score: validScore(rating.score) ? rating.score : null,
        threadId,
        reactions: reactionCount(sources.responses, threadId),
    };
};

/**
 * Club reviews written in the year: one added on the site counts when it was
 * added, and one from the sheet counts in the year of its screening.
 */
const clubReviewsIn = (year: number, sources: RetrospectiveSources): RetrospectiveReview[] =>
    sources.films.flatMap((film) =>
        (film.movieClubInfo?.clubRatings ?? []).flatMap((rating) => {
            const blurb = rating.blurb?.trim();
            if (!blurb) return [];
            const written = rating.blurbAddedAt ? instantYear(rating.blurbAddedAt) : clubYear(film);
            if (written !== year) return [];
            return [clubReview(film, rating, blurb, sources)];
        })
    );

/**
 * Voices from the future: reviews of the year's club films written in a later
 * year by someone who only joined the club after it ({@link CLUB_YEARS}). They
 * still count in the year they were written; this only lets a year borrow them.
 */
const futureVoices = (year: number, sources: RetrospectiveSources): FutureReview[] =>
    clubFilmsIn(sources.films, year).flatMap((film) =>
        (film.movieClubInfo?.clubRatings ?? []).flatMap((rating) => {
            const blurb = rating.blurb?.trim();
            const writtenAt = rating.blurbAddedAt;
            if (!blurb || !writtenAt || (instantYear(writtenAt) ?? -Infinity) <= year) return [];
            const joined = CLUB_YEARS[rating.user.trim().toLowerCase()]?.joined;
            if (joined === undefined || joined <= year) return [];
            return [{ ...clubReview(film, rating, blurb, sources), writtenAt }];
        })
    );

const logReviews = (logged: LoggedFilm[], responses: ResponsesFile): RetrospectiveReview[] =>
    logged.flatMap((l) => {
        const blurb = l.entry.blurb?.trim();
        if (!blurb) return [];
        const threadId = logThreadId(l.member, l.imdbID);
        return [
            {
                source: 'log' as const,
                member: l.member,
                imdbID: l.imdbID,
                title: l.title ?? l.imdbID,
                poster: l.poster,
                blurb,
                words: wordCount(blurb),
                score: validScore(l.entry.score) ? l.entry.score : null,
                threadId,
                reactions: reactionCount(responses, threadId),
            },
        ];
    });

const longestReview = (reviews: RetrospectiveReview[]): RetrospectiveReview =>
    reviews.reduce((best, r) => (r.words > best.words ? r : best));

const mostReactedReview = (reviews: RetrospectiveReview[]): RetrospectiveReview | null => {
    const top = reviews.reduce<RetrospectiveReview | null>(
        (best, r) => (r.reactions > (best?.reactions ?? 0) ? r : best),
        null
    );
    return top && top.reactions > 0 ? top : null;
};

/**
 * Every thread the site could have hung reactions on, with the year its subject
 * belongs to. Reactions carry no date of their own, so this is how one is dated.
 */
const threadIndex = (
    sources: RetrospectiveSources,
    clubIndex: Map<string, Film>
): Map<string, { year: number; subject: ThreadSubject }> => {
    const index = new Map<string, { year: number; subject: ThreadSubject }>();
    const add = (year: number | null, subject: ThreadSubject) => {
        if (year !== null) index.set(subject.threadId, { year, subject });
    };

    sources.films.forEach((film) => {
        const year = clubYear(film);
        add(year, {
            threadId: clubThreadId(film.imdbID),
            kind: 'club',
            title: film.title,
            member: null,
            imdbID: film.imdbID,
            listId: null,
        });
        film.movieClubInfo?.clubRatings.forEach((rating) => {
            const member = displayName(rating.user, sources.members);
            add(instantYear(firstAdded(film, rating.user)) ?? year, {
                threadId: reviewThreadId(member, film.imdbID),
                kind: 'review',
                title: film.title,
                member,
                imdbID: film.imdbID,
                listId: null,
            });
        });
    });

    Object.entries(sources.watched).forEach(([owner, entries]) => {
        const member = displayName(owner, sources.members);
        entries.forEach((entry) => {
            const logged = resolveLogged(member, entry, sources, clubIndex);
            add(logYear(entry), {
                threadId: logThreadId(member, entry.imdbID),
                kind: 'log',
                title: logged.title ?? entry.imdbID,
                member,
                imdbID: entry.imdbID,
                listId: null,
            });
        });
    });

    sources.lists.forEach((list) =>
        add(instantYear(list.createdAt), {
            threadId: listThreadId(list.id),
            kind: 'list',
            title: list.name,
            member: list.owner,
            imdbID: null,
            listId: list.id,
        })
    );

    return index;
};

// ---------------------------------------------------------------------------
// Trophies
// ---------------------------------------------------------------------------

/**
 * Every award given in the year: a sheet award with its screening, a site award
 * when it was handed out — which may be a year after the film it was for.
 */
const trophiesIn = (year: number, sources: RetrospectiveSources): MemberTrophy[] => {
    const awardedAt = new Map<string, string>();
    Object.entries(sources.trophies).forEach(([imdbID, trophies]) =>
        trophies.forEach((t) => awardedAt.set(`${imdbID}\n${t.id}`, t.awardedAt))
    );
    const clubIndex = new Map(sources.films.map((f) => [f.imdbID, f]));

    return getClubTrophies(sources.films, sources.trophies).filter((trophy) =>
        trophy.source === 'sheet'
            ? clubYear(clubIndex.get(trophy.film.imdbID)!) === year
            : instantYear(awardedAt.get(`${trophy.film.imdbID}\n${trophy.id}`)) === year
    );
};

// ---------------------------------------------------------------------------
// Club figures
// ---------------------------------------------------------------------------

/** Every field a club film credits people in, as `getAllFilmCreditsForPerson` reads them. */
const CREDIT_FIELDS = [
    'director',
    'writer',
    'actors',
    'cinematographer',
    'editor',
    'productionDesigner',
    'musicComposer',
    'costumeDesigner',
] as const;

/** Everyone a film credits, by name, once each. */
const creditedNames = (films: Film[]): string[] => {
    const names = new Map<string, string>();
    films.forEach((film) =>
        [
            ...CREDIT_FIELDS.flatMap((field) => listed(film[field])),
            ...(film.cast ?? []).map((c) => c.name),
        ]
            .map((name) => name?.trim())
            .filter((name): name is string => !!name)
            .forEach((name) => {
                const key = name.toLowerCase();
                if (!names.has(key)) names.set(key, name);
            })
    );
    return [...names.values()];
};

/** How much a set of credits says about a person: directing most, then acting and writing. */
const ROLE_WEIGHT: Record<string, number> = { Director: 3, Actor: 2, Writer: 2 };
const weightOf = (credits: Credit[]): number =>
    credits.reduce(
        (sum, c) => sum + Math.max(1, ...c.roles.map((role) => ROLE_WEIGHT[role] ?? 1)),
        0
    );

/** The part a person played in a film, as its TMDb cast lists it. */
const characterOf = (name: string, film: Film): string | undefined => {
    const key = name.trim().toLowerCase();
    const character = film.cast
        ?.find((c) => c.name?.trim().toLowerCase() === key)
        ?.character?.trim();
    return character || undefined;
};

const creditsOf = (name: string, films: Film[]): Credit[] =>
    getAllFilmCreditsForPerson(name, films).map(({ film, roles }) => {
        const character = roles.includes('Actor') ? characterOf(name, film) : undefined;
        return character ? { film, roles, character } : { film, roles };
    });

const FACES_LIMIT = 3;

/**
 * The people credited on the most of the year's films, through the same lookup
 * `useFrequentPersons` counts with — so the almanac and the retrospective name
 * the same people.
 */
const frequentFaces = (films: Film[]): ClubRetrospective['faces'] => {
    const faces = creditedNames(films)
        .map((name) => ({ name, credits: creditsOf(name, films) }))
        .filter((face) => face.credits.length >= 2)
        .sort(
            (a, b) =>
                b.credits.length - a.credits.length ||
                weightOf(b.credits) - weightOf(a.credits) ||
                a.name.localeCompare(b.name)
        )
        .slice(0, FACES_LIMIT);
    return faces.length ? faces : null;
};

/** People on the year's films the club had already met on an earlier year's. */
const returningFaces = (
    year: number,
    films: Film[],
    allFilms: Film[],
    skip: Set<string>
): ClubRetrospective['returning'] => {
    const earlier = allFilms
        .map((film) => ({ film, year: clubYear(film) }))
        .filter((f): f is { film: Film; year: number } => f.year !== null && f.year < year);
    const yearOf = new Map(earlier.map((f) => [f.film.imdbID, f.year]));
    const earlierFilms = earlier.map((f) => f.film);

    const returning = creditedNames(films)
        .filter((name) => !skip.has(name.toLowerCase()))
        .map((name) => ({
            name,
            now: creditsOf(name, films),
            before: creditsOf(name, earlierFilms)
                .map((c) => ({ ...c, year: yearOf.get(c.film.imdbID)! }))
                .sort((a, b) => b.year - a.year),
        }))
        .filter((person) => person.before.length > 0)
        .sort(
            (a, b) =>
                b.now.length + b.before.length - (a.now.length + a.before.length) ||
                weightOf([...b.now, ...b.before]) - weightOf([...a.now, ...a.before]) ||
                a.name.localeCompare(b.name)
        )
        .slice(0, FACES_LIMIT);
    return returning.length ? returning : null;
};

/** Fewer words than this is a one-liner, quoted only to hear from its writer at all. */
const FULL_REVIEW_WORDS = 8;

/**
 * A few reviews worth quoting, as evenly spread across the writers as the
 * number allows: everyone once, their fullest, before anyone twice. A second
 * quote from anyone skips their one-liners while someone has a fuller review
 * left. No film is quoted twice unless it's the only way to hear from someone.
 * Voices from the future go last.
 */
const highlightReviews = (reviews: RetrospectiveReview[], limit: number): RetrospectiveReview[] => {
    const ranked = [...reviews].sort((a, b) => b.words - a.words || b.reactions - a.reactions);
    const queues = new Map<string, RetrospectiveReview[]>();
    ranked.forEach((r) => queues.set(r.member, [...(queues.get(r.member) ?? []), r]));

    const picked: RetrospectiveReview[] = [];
    const films = new Set<string>();
    const heard = new Set<string>();
    // Rounds of one each, until a round finds nothing to take.
    const rounds = (takes: (r: RetrospectiveReview) => boolean) => {
        let took = true;
        while (took && picked.length < limit) {
            took = false;
            for (const [member, queue] of queues) {
                if (picked.length >= limit) break;
                const fresh = queue.findIndex((r) => !films.has(r.imdbID) && takes(r));
                const at = fresh >= 0 || heard.has(member) || !queue.length ? fresh : 0;
                if (at < 0) continue;
                const [next] = queue.splice(at, 1);
                picked.push(next);
                films.add(next.imdbID);
                heard.add(member);
                took = true;
            }
        }
    };
    rounds((r) => !heard.has(r.member) || r.words >= FULL_REVIEW_WORDS);
    rounds(() => true);
    return [...picked.filter((r) => !r.writtenAt), ...picked.filter((r) => r.writtenAt)];
};

/**
 * A member's reviews to quote: their three highest-scored, then the lowest
 * score they reviewed last. Ties go to the fuller review, and no film appears
 * twice. When too few reviews carry a score, the fullest unscored ones fill in.
 */
const memberHighlightReviews = (reviews: RetrospectiveReview[]): RetrospectiveReview[] => {
    const scored = reviews.filter((r) => r.score !== null);
    const byScore = (dir: 1 | -1) =>
        [...scored].sort((a, b) => dir * (b.score! - a.score!) || b.words - a.words);
    const top: RetrospectiveReview[] = [];
    const films = new Set<string>();
    for (const r of byScore(1)) {
        if (top.length >= 3) break;
        if (films.has(r.imdbID)) continue;
        top.push(r);
        films.add(r.imdbID);
    }
    const lowest = byScore(-1).find((r) => !films.has(r.imdbID));
    const picked = lowest ? [...top, lowest] : top;
    if (picked.length >= 4) return picked;
    const used = new Set(picked.map((r) => r.imdbID));
    const fill = highlightReviews(
        reviews.filter((r) => !used.has(r.imdbID)),
        4 - picked.length
    );
    // Keep the lowest-scored review last.
    return lowest ? [...top, ...fill, lowest] : [...top, ...fill];
};

/**
 * The quotes with someone allowed to open them ({@link WORDS_NEVER_FIRST})
 * moved to the front, the rest in order. A voice from the present is
 * preferred; one from the future opens only when nobody else can.
 */
const openWithAllowed = (reviews: RetrospectiveReview[]): RetrospectiveReview[] => {
    const allowed = (r: RetrospectiveReview) =>
        !WORDS_NEVER_FIRST.includes(r.member.trim().toLowerCase());
    const at = [
        reviews.findIndex((r) => allowed(r) && !r.writtenAt),
        reviews.findIndex(allowed),
    ].find((i) => i >= 0);
    return at === undefined || at === 0
        ? reviews
        : [reviews[at], ...reviews.slice(0, at), ...reviews.slice(at + 1)];
};

/** The club's hand-picked quotes first, then the fullest reviews to make up the number. */
const featuredReviews = (reviews: RetrospectiveReview[], limit: number): RetrospectiveReview[] => {
    const picked = FEATURED_CLUB_REVIEWS.map((id) => reviews.find((r) => r.threadId === id)).filter(
        (r): r is RetrospectiveReview => !!r
    );
    if (picked.length >= limit) return picked.slice(0, limit);
    const used = new Set(picked.map((r) => r.imdbID));
    const rest = highlightReviews(
        reviews.filter((r) => !used.has(r.imdbID)),
        limit - picked.length
    );
    return [...picked, ...rest];
};

// ---------------------------------------------------------------------------
// Standout: how the year differed from every other
// ---------------------------------------------------------------------------

/** One measure of a year's films, with the films that make it, highest first. */
interface Figure {
    value: number;
    share?: { count: number; of: number };
    films: Film[];
}

interface Measure {
    /** The year's figure, from its club films and the members with the club that year. */
    figure: (films: FilmWithDate[], members: TeamMember[]) => Figure | null;
    /** The figure as the slide prints it, so a record is one the reader can see. */
    shown: (value: number) => number;
    /** An average or a share, which says little about a year of only a film or two. */
    rate: boolean;
}

const toTenth = (n: number): number => Math.round(n * 10) / 10;

/** The members' scores on a film, guests' left out. */
const memberScoresOn = (film: Film, members: TeamMember[]): number[] =>
    (film.movieClubInfo?.clubRatings ?? [])
        .filter((r) => validScore(r.score) && members.some((m) => sameName(m.name, r.user)))
        .map((r) => r.score as number);

/** The mean of a figure taken film by film, with the films highest first. */
const averaged = (films: Film[], of: (film: Film) => number | null): Figure | null => {
    const ranked = films
        .map((film) => ({ film, value: of(film) }))
        .filter((f): f is { film: Film; value: number } => f.value !== null)
        .sort((a, b) => b.value - a.value);
    const value = mean(ranked.map((f) => f.value));
    return value === null ? null : { value, films: ranked.map((f) => f.film) };
};

/** The percentage of the films whose first value in a category passes `test`. */
const shareOf = (
    films: Film[],
    category: 'country' | 'language',
    test: (value: string) => boolean
): Figure | null => {
    const known = films.filter((film) => categoryValuesOf(film, category).length);
    const matching = known.filter((film) => test(categoryValuesOf(film, category)[0]));
    return known.length
        ? {
              value: (matching.length / known.length) * 100,
              share: { count: matching.length, of: known.length },
              films: matching,
          }
        : null;
};

/** A count of the year's films, or of something about them, with the films in watch order. */
const counted =
    (count: (films: FilmWithDate[]) => number) =>
    (films: FilmWithDate[]): Figure | null =>
        films.length ? { value: count(films), films } : null;

const MEASURES = {
    /**
     * The members' average score: the mean of each film's average, from those
     * with the club that year. Popcorn pods aren't in it. The count slide's
     * year-by-year averages are this.
     */
    score: {
        rate: true,
        shown: toTenth,
        figure: (films, members) =>
            averaged(
                films.filter((film) => !film.popcornPod),
                (film) => mean(memberScoresOn(film, members))
            ),
    },
    films: { rate: false, shown: Math.round, figure: counted((films) => films.length) },
    hours: {
        rate: false,
        shown: Math.round,
        figure: counted(
            (films) => minutesOf(films.filter((f) => !isPodFilm(f)).map((f) => f.runtime)) / 60
        ),
    },
    countries: {
        rate: false,
        shown: Math.round,
        figure: counted((films) => categoryCounts(films, 'country').length),
    },
    languages: {
        rate: false,
        shown: Math.round,
        figure: counted((films) => categoryCounts(films, 'language').length),
    },
    notEnglish: {
        rate: true,
        shown: Math.round,
        figure: (films) => shareOf(films, 'language', (language) => language !== 'English'),
    },
    notAmerican: {
        rate: true,
        shown: Math.round,
        figure: (films) => shareOf(films, 'country', (country) => country !== 'United States'),
    },
    releaseYear: {
        rate: true,
        shown: Math.round,
        figure: (films) =>
            averaged(films, (film) => (decadeOf(film.year) ? parseInt(film.year, 10) : null)),
    },
    /** How far apart the members' scores on a film were, highest to lowest, on average. */
    spread: {
        rate: true,
        shown: toTenth,
        figure: (films, members) =>
            averaged(
                films.filter((film) => !film.popcornPod),
                (film) => {
                    const scores = memberScoresOn(film, members);
                    return scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : null;
                }
            ),
    },
    runtime: {
        rate: true,
        shown: Math.round,
        figure: (films) => averaged(films, (film) => parseRuntime(film.runtime)),
    },
    months: {
        rate: false,
        shown: Math.round,
        figure: counted((films) => new Set(films.map((f) => f.parsedWatchDate.getUTCMonth())).size),
    },
} satisfies Record<string, Measure>;

type MeasureName = keyof typeof MEASURES;

/**
 * Each standout: the measure, and whether the year has to have the most of it
 * or the least. The order is the order they're tried in.
 */
const STANDOUTS: { kind: StandoutKind; measure: MeasureName; most: boolean }[] = [
    { kind: 'highest-score', measure: 'score', most: true },
    { kind: 'lowest-score', measure: 'score', most: false },
    { kind: 'most-films', measure: 'films', most: true },
    { kind: 'most-hours', measure: 'hours', most: true },
    { kind: 'most-countries', measure: 'countries', most: true },
    { kind: 'most-languages', measure: 'languages', most: true },
    { kind: 'least-english', measure: 'notEnglish', most: true },
    { kind: 'least-american', measure: 'notAmerican', most: true },
    { kind: 'oldest', measure: 'releaseYear', most: false },
    { kind: 'agreed', measure: 'spread', most: false },
    { kind: 'divided', measure: 'spread', most: true },
    { kind: 'newest', measure: 'releaseYear', most: true },
    { kind: 'longest', measure: 'runtime', most: true },
    { kind: 'most-months', measure: 'months', most: true },
];

/** Fewer years than this, and topping them is hardly standing out. */
const STANDOUT_MIN_YEARS = 3;
/** A year with fewer films than this has no average or share worth comparing. */
const STANDOUT_MIN_FILMS = 3;

/** The members with the club in a year. */
const membersIn = (year: number, sources: RetrospectiveSources): TeamMember[] =>
    sources.members.filter((member) => inClubIn(member, year));

/** A measure's figure for one year, or null when the year hasn't one. */
const figureIn = (
    name: MeasureName,
    year: number,
    sources: RetrospectiveSources
): Figure | null => {
    const measure: Measure = MEASURES[name];
    const films = clubFilmsIn(sources.films, year);
    if (measure.rate && films.length < STANDOUT_MIN_FILMS) return null;
    return measure.figure(films, membersIn(year, sources));
};

/**
 * The first standout the year holds outright against every other year with
 * club films, later ones included, compared as the slide prints them, so a
 * tie on the page is no record.
 */
const standoutIn = (year: number, sources: RetrospectiveSources): Standout | null => {
    const years = [
        ...new Set(sources.films.map(clubYear).filter((y): y is number => y !== null)),
    ].sort((a, b) => a - b);
    const byMeasure = new Map<MeasureName, ({ year: number; shown: number } & Figure)[]>();
    const figuresOf = (name: MeasureName) => {
        if (!byMeasure.has(name)) {
            byMeasure.set(
                name,
                years.flatMap((y) => {
                    const figure = figureIn(name, y, sources);
                    return figure
                        ? [{ year: y, shown: MEASURES[name].shown(figure.value), ...figure }]
                        : [];
                })
            );
        }
        return byMeasure.get(name)!;
    };

    for (const { kind, measure, most } of STANDOUTS) {
        const figures = figuresOf(measure);
        const mine = figures.find((f) => f.year === year);
        const others = figures.filter((f) => f.year !== year);
        if (!mine || figures.length < STANDOUT_MIN_YEARS) continue;
        if (!others.every((o) => (most ? mine.shown > o.shown : mine.shown < o.shown))) continue;
        const next = (most ? Math.max : Math.min)(...others.map((o) => o.shown));
        return {
            kind,
            years: figures.map((f) => ({ year: f.year, value: f.shown })),
            next: { value: next, years: others.filter((o) => o.shown === next).map((o) => o.year) },
            share: mine.share ?? null,
            films: most ? mine.films : [...mine.films].reverse(),
        };
    }
    return null;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Every year with a club screening or a log entry in it, earliest first. These
 * are the years with a club report: a log entry alone is enough for one, on the
 * off-docket slide.
 */
export const yearsWithData = (sources: RetrospectiveSources): number[] => {
    const years = new Set<number>();
    sources.films.forEach((film) => {
        const year = clubYear(film);
        if (year !== null) years.add(year);
    });
    Object.values(sources.watched).forEach((entries) =>
        entries.forEach((entry) => {
            const year = logYear(entry);
            if (year !== null) years.add(year);
        })
    );
    return [...years].sort((a, b) => a - b);
};

export const buildClubRetrospective = (
    year: number,
    sources: RetrospectiveSources,
    now: Date = new Date()
): ClubRetrospective => {
    const films = clubFilmsIn(sources.films, year);
    const clubIndex = new Map(sources.films.map((f) => [f.imdbID, f]));
    const logged = loggedIn(year, sources, clubIndex);
    const active = sources.members.filter((member) => inClubIn(member, year));

    // Count
    const filmsBefore = clubFilmsIn(sources.films, year - 1);
    const previous = filmsBefore.length;
    const earlierYears = new Map<number, number>();
    sources.films.forEach((film) => {
        const y = clubYear(film);
        if (y !== null && y < year) earlierYears.set(y, (earlierYears.get(y) ?? 0) + 1);
    });
    // As the member deck's year-on-year: a most-since needs a few years behind
    // it, or it's only "up from last year" said grandly.
    const matched = [...earlierYears]
        .filter(([, n]) => n >= films.length)
        .reduce<number | null>((latest, [y]) => (latest === null || y > latest ? y : latest), null);
    const mostSince =
        matched === null
            ? earlierYears.size > 1
                ? ('ever' as const)
                : null
            : matched < year - 2
              ? matched
              : null;
    const yearAverage = (y: number): number | null =>
        MEASURES.score.figure(clubFilmsIn(sources.films, y), membersIn(y, sources))?.value ?? null;
    const averages = [...earlierYears.keys(), year]
        .sort((a, b) => a - b)
        .map((y) => ({ year: y, average: yearAverage(y) }))
        .filter((a): a is { year: number; average: number } => a.average !== null);
    const count: ClubRetrospective['count'] = films.length
        ? {
              films: films.length,
              minutes: minutesOf(films.filter((f) => !isPodFilm(f)).map((f) => f.runtime)),
              previousYear: previous || null,
              mostSince,
              averages,
          }
        : null;

    // Calendar
    const gaps = meetingIntervals(films);
    const longest = gaps.reduce<(typeof gaps)[number] | null>(
        (best, gap) => (gap.days > (best?.days ?? -1) ? gap : best),
        null
    );
    const calendar: ClubRetrospective['calendar'] = films.length
        ? {
              busiestMonth: busiestMonth(films.map((f) => f.parsedWatchDate.getUTCMonth()))!,
              longestGap: longest
                  ? { days: longest.days, from: films[longest.index - 1], to: longest.film }
                  : null,
              first: films[0],
              last: films[films.length - 1],
          }
        : null;

    // Places
    const releaseYears = (list: Film[]): number[] =>
        list.filter((f) => decadeOf(f.year)).map((f) => parseInt(f.year, 10));
    const averageYear = (list: Film[]): number | null => {
        const average = mean(releaseYears(list));
        return average === null ? null : Math.round(average);
    };
    const byRelease = films
        .filter((f) => decadeOf(f.year))
        .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));
    const places: ClubRetrospective['places'] = byRelease.length
        ? {
              countries: categoryCounts(films, 'country'),
              languages: categoryCounts(films, 'language'),
              decades: categoryCounts(films, 'decade'),
              averageYear: averageYear(films)!,
              oldest: byRelease[0],
              newest: byRelease[byRelease.length - 1],
              previousYear: filmsBefore.length
                  ? {
                        countries: categoryCounts(filmsBefore, 'country').length,
                        averageYear: averageYear(filmsBefore),
                    }
                  : null,
          }
        : null;

    // Favourites: each member's own, side by side
    const favourites = active
        .map((member) => {
            const pair = lovedAndLeast(scoresBy(films, member.name));
            return pair ? { member, ...pair } : null;
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);

    // Together: the members' average on each film, two scores or more
    const averaged = films
        .map((film) => {
            const scores = (film.movieClubInfo?.clubRatings ?? [])
                .filter((r) => validScore(r.score) && active.some((m) => sameName(m.name, r.user)))
                .map((r) => r.score as number);
            const average = scores.length >= 2 ? mean(scores) : null;
            return average === null ? null : { film: film as Film, average };
        })
        .filter((a): a is { film: Film; average: number } => a !== null)
        .sort((a, b) => b.average - a.average);
    const last = averaged[averaged.length - 1];
    const together: ClubRetrospective['together'] = averaged.length
        ? {
              loved: averaged[0],
              leastLoved: averaged.length > 1 && last.average < averaged[0].average ? last : null,
          }
        : null;

    // Selections: who picked what, in the order they first came up
    const selections: { selector: string; films: Film[] }[] = [];
    films
        .filter((f) => !isPodFilm(f))
        .forEach((film) => {
            const selector = film.movieClubInfo?.selector?.trim();
            if (!selector) return;
            const existing = selections.find((s) => sameName(s.selector, selector));
            if (existing) existing.films.push(film);
            else selections.push({ selector, films: [film] });
        });

    // Trophies
    const awarded = trophiesIn(year, sources);
    const byAward = groupTrophies(awarded);
    const byRecipient = groupByRecipient(awarded).filter((g) => g.recipient !== null);
    const trophies: ClubRetrospective['trophies'] = awarded.length
        ? {
              total: awarded.length,
              mostGiven: { award: byAward[0].award, count: byAward[0].trophies.length },
              topRecipient: byRecipient.length
                  ? {
                        recipient: byRecipient[0].recipient!,
                        count: byRecipient[0].trophies.length,
                    }
                  : null,
              trophies: awarded,
          }
        : null;

    // Off the docket
    const docketLogs = offDocketLogs(logged, sources.members);
    // In log order, so earliest watched first; the sort below is stable.
    const loggers = new Map<
        string,
        { first: LoggedFilm; members: Set<string>; owners: Set<string> }
    >();
    docketLogs.forEach(({ member, logged: l }) => {
        const film = loggers.get(l.imdbID) ?? { first: l, members: new Set(), owners: new Set() };
        film.members.add(member);
        film.owners.add(l.member);
        loggers.set(l.imdbID, film);
    });
    const sharedFilms = [...loggers.values()]
        .filter((f) => f.members.size >= 2)
        .sort((a, b) => b.members.size - a.members.size || b.owners.size - a.owners.size)
        .slice(0, SHARED_FILMS_SHOWN)
        .map(({ first, members }) => ({
            imdbID: first.imdbID,
            title: first.title ?? first.imdbID,
            poster: first.poster,
            members: [...members].sort(),
        }));
    const firstDocketYear = firstOffDocketYear(sources);
    const offDocket: ClubRetrospective['offDocket'] =
        docketLogs.length && firstDocketYear !== null && year >= firstDocketYear
            ? {
                  entries: docketLogs.length,
                  byMember: tally(docketLogs.map((d) => d.member)),
                  sharedFilms,
              }
            : null;

    // Words
    const clubReviews = clubReviewsIn(year, sources);
    const allReviews = [...clubReviews, ...logReviews(logged, sources.responses)];
    // Anyone who joined later and has since written on the year's films is
    // heard from too. The slide is the club's voices, so it needs two.
    const future = futureVoices(year, sources);
    const voices = new Set([...allReviews, ...future].map((r) => r.member));
    const words: ClubRetrospective['words'] =
        voices.size >= 2
            ? {
                  count: allReviews.length,
                  club: clubReviews.length,
                  log: allReviews.length - clubReviews.length,
                  hadLogs: logged.length > 0,
                  longest: longestReview(allReviews),
                  mostReacted: mostReactedReview(allReviews),
                  highlights: openWithAllowed(featuredReviews([...allReviews, ...future], 4)),
                  future,
              }
            : null;

    // Faces
    const faces = frequentFaces(films);

    // Reactions
    const threads = threadIndex(sources, clubIndex);
    const byKey = new Map<ReactionKey, number>();
    let total = 0;
    let topThread: { subject: ThreadSubject; count: number } | null = null;
    for (const [threadId, thread] of Object.entries(sources.responses.threads)) {
        const known = threads.get(threadId);
        if (!known || known.year !== year) continue;
        let taps = 0;
        (Object.entries(thread.reactions) as [ReactionKey, string[] | undefined][]).forEach(
            ([key, members]) => {
                const n = members?.length ?? 0;
                taps += n;
                byKey.set(key, (byKey.get(key) ?? 0) + n);
            }
        );
        total += taps;
        if (taps > (topThread?.count ?? 0)) topThread = { subject: known.subject, count: taps };
    }
    const topReaction = [...byKey.entries()].sort(
        ([a, x], [b, y]) => y - x || a.localeCompare(b)
    )[0];
    const reactions: ClubRetrospective['reactions'] =
        total > 0 && topThread
            ? { total, topReaction: { key: topReaction[0], count: topReaction[1] }, topThread }
            : null;

    return {
        year,
        inProgress: year >= now.getFullYear(),
        films,
        count,
        calendar,
        standout: films.length ? standoutIn(year, sources) : null,
        places,
        favourites: favourites.length ? favourites : null,
        together,
        selections: selections.length ? selections : null,
        trophies,
        offDocket,
        words,
        reactions,
        faces,
        returning: returningFaces(
            year,
            films,
            sources.films,
            new Set((faces ?? []).map((f) => f.name.toLowerCase()))
        ),
        roster: active.filter(
            (member) => films.length > 0 || hasMemberData(year, member.name, sources)
        ),
        reports: sources.members.filter((member) => hasReport(year, member, sources)),
        guests: sources.members
            .filter((member) => !isActive(member) && !inClubIn(member, year))
            .map((member) => ({ member, films: scoresBy(films, member.name).map((s) => s.film) }))
            .filter((guest) => guest.films.length > 0),
        welcomes: welcomesIn(year, films, sources.members),
    };
};

/**
 * The year's newcomers, in `club.json` order: members whose {@link CLUB_YEARS}
 * joined year it is, and anyone {@link WELCOMES} names it for.
 */
const welcomesIn = (
    year: number,
    films: FilmWithDate[],
    members: TeamMember[]
): ClubRetrospective['welcomes'] => {
    const welcomes = members.flatMap((member) => {
        const key = member.name.toLowerCase();
        const welcome = WELCOMES[key];
        if ((welcome?.year ?? CLUB_YEARS[key]?.joined) !== year) return [];
        const first =
            films.find((film) =>
                film.movieClubInfo?.clubRatings.some(
                    (r) => sameName(r.user, member.name) && validScore(r.score)
                )
            ) ?? null;
        return [{ member, line: welcome?.line ?? DEFAULT_WELCOME, first }];
    });
    return welcomes.length ? welcomes : null;
};

/** True when a member scored a club film or logged one in the year. */
const hasMemberData = (year: number, name: string, sources: RetrospectiveSources): boolean =>
    sources.films.some(
        (film) =>
            clubYear(film) === year &&
            film.movieClubInfo?.clubRatings.some(
                (r) => sameName(r.user, name) && validScore(r.score)
            )
    ) || logOf(sources.watched, name).some((entry) => logYear(entry) === year);

/**
 * True when a member has a report of their own for `year`: a current member,
 * with the club that year, who scored a club film or logged one in it. A guest
 * or past member never has one.
 */
const hasReport = (year: number, member: TeamMember, sources: RetrospectiveSources): boolean =>
    isActive(member) && inClubIn(member, year) && hasMemberData(year, member.name, sources);

/** Every year a member has a report of their own, earliest first. */
export const memberYears = (memberName: string, sources: RetrospectiveSources): number[] => {
    const member = sources.members.find((m) => sameName(m.name, memberName));
    if (!member) return [];
    return yearsWithData(sources).filter((year) => hasReport(year, member, sources));
};

/**
 * One active member's year, or null when they neither scored a club film nor
 * logged one in it. Guests and past members have no report: the members are
 * the subject, and a guest is a line on the club's closing slide.
 */
export const buildMemberRetrospective = (
    year: number,
    memberName: string,
    sources: RetrospectiveSources,
    now: Date = new Date()
): MemberRetrospective | null => {
    const member = sources.members.find((m) => sameName(m.name, memberName));
    if (!member || !hasReport(year, member, sources)) return null;
    const name = member.name;

    const yearFilms = clubFilmsIn(sources.films, year);
    const clubIndex = new Map(sources.films.map((f) => [f.imdbID, f]));
    const scoreOf = (film: Film): number | null => {
        const rating = film.movieClubInfo?.clubRatings.find((r) => sameName(r.user, name));
        return validScore(rating?.score) ? rating!.score : null;
    };

    // Their club films are the ones they scored: a screening they missed and
    // never scored isn't one they saw.
    const club = yearFilms.filter((film) => scoreOf(film) !== null);
    const log = logOf(sources.watched, name)
        .filter((entry) => logYear(entry) === year)
        .map((entry) => resolveLogged(name, entry, sources, clubIndex))
        .sort(
            (a, b) =>
                a.entry.watchDate.localeCompare(b.entry.watchDate) ||
                a.imdbID.localeCompare(b.imdbID)
        );

    const count = {
        withClub: club.length,
        onOwn: log.length,
        minutes: {
            withClub: minutesOf(club.map((f) => f.runtime)),
            onOwn: minutesOf(log.map((l) => l.runtime)),
        },
        history: clubHistory(sources.films, name, year),
    };

    // Scores
    const stats = calculateMemberStats(name, yearFilms);
    const byScore = scoresBy(club, name);
    const pair = lovedAndLeast(byScore);
    const distribution = Array.from({ length: 10 }, (_, score) => ({
        score,
        count: byScore.filter((s) => Math.min(9, Math.floor(s.score)) === score).length,
    }));
    const logScores = log.map((l) => l.entry.score).filter(validScore);
    const scores: MemberRetrospective['scores'] = pair
        ? {
              average: stats.avgGivenScore ?? mean(byScore.map((s) => s.score))!,
              count: byScore.length,
              distribution,
              highest: pair.loved,
              lowest: pair.leastLoved,
              logAverage: mean(logScores),
              logCount: logScores.length,
          }
        : null;

    // Picks
    const theirPicks = yearFilms.filter(
        (film) => !isPodFilm(film) && sameName(film.movieClubInfo?.selector, name)
    );

    // Breakaway
    // Their film is, first, one where they stood furthest from the rest of the
    // room (or tied for it). Failing that, the widest gap on a film where they
    // weren't part of the majority — so a split room still counts. A film where
    // most of the room scored within a point of them never does: at 2, 2, 2, 8
    // it's the 8's film, and the 2s were with the group even though the 8 pulls
    // their "everyone else" average up.
    type Breakaway = NonNullable<MemberRetrospective['breakaway']>;
    const furthestApart: Breakaway[] = [];
    const outsideMajority: Breakaway[] = [];
    for (const film of club) {
        const ratings = film.movieClubInfo!.clubRatings.filter((r) => validScore(r.score));
        const apart = ratings.map((rating) => {
            const others = ratings.filter((r) => r !== rating).map((r) => r.score as number);
            const othersAverage = mean(others);
            return {
                rating,
                othersAverage,
                divergence: othersAverage === null ? 0 : (rating.score as number) - othersAverage,
            };
        });
        const theirs = apart.find((a) => sameName(a.rating.user, name));
        if (!theirs || theirs.othersAverage === null || !theirs.divergence) continue;
        const score = theirs.rating.score as number;
        const candidate = {
            film,
            score,
            othersAverage: theirs.othersAverage,
            divergence: theirs.divergence,
        };
        const furthest = Math.max(...apart.map((a) => Math.abs(a.divergence)));
        const alongside = ratings.filter(
            (r) => Math.abs((r.score as number) - score) <= WITH_THE_GROUP
        ).length;
        if (Math.abs(theirs.divergence) >= furthest - 1e-9) furthestApart.push(candidate);
        else if (alongside * 2 <= ratings.length) outsideMajority.push(candidate);
    }
    const widest = (candidates: Breakaway[]): Breakaway | null =>
        candidates.reduce<Breakaway | null>(
            (best, c) => (!best || Math.abs(c.divergence) > Math.abs(best.divergence) ? c : best),
            null
        );
    const breakaway = widest(furthestApart) ?? widest(outsideMajority);

    // Log
    // Another member's log, or theirs naming someone they watched it with.
    const othersLogged = new Set([
        ...Object.entries(sources.watched)
            .filter(([owner]) => !sameName(owner, name))
            .flatMap(([, entries]) => entries.map((e) => e.imdbID)),
        ...log.filter((l) => companionsOf(l, sources.members).length).map((l) => l.imdbID),
    ]);
    const watchedByClub = new Set(
        sources.films.filter((f) => clubYear(f) !== null).map((f) => f.imdbID)
    );
    const logSlide: MemberRetrospective['log'] = log.length
        ? {
              busiestMonth: busiestMonth(
                  log.map((l) => parseInt(l.entry.watchDate.slice(5, 7), 10) - 1)
              )!,
              longestWeekStreak: longestWeekStreak(log.map((l) => l.entry.watchDate)),
              first: log[0],
              last: log[log.length - 1],
              solo: new Set(
                  log
                      .map((l) => l.imdbID)
                      .filter((id) => !othersLogged.has(id) && !watchedByClub.has(id))
              ).size,
          }
        : null;

    // Taste and director
    const inputs: TasteInput[] = [...club.map(tasteOfFilm), ...log.map(tasteOfLogged)];
    const genres = tally(inputs.flatMap((t) => t.genres));
    const decades = tally(inputs.map((t) => t.decade).filter((d): d is string => !!d));
    const countries = tally(inputs.map((t) => t.country).filter((c): c is string => !!c));
    const taste: MemberRetrospective['taste'] =
        genres.length || decades.length || countries.length ? { genres, decades, countries } : null;

    const directorCounts = new Map<string, NonNullable<MemberRetrospective['director']>>();
    inputs.forEach((t) =>
        t.directors.forEach((director) => {
            const key = director.toLowerCase();
            const entry = directorCounts.get(key) ?? {
                name: director,
                withClub: 0,
                onOwn: 0,
                imdbIDs: [],
            };
            if (t.source === 'club') entry.withClub++;
            else entry.onOwn++;
            if (!entry.imdbIDs.includes(t.imdbID)) entry.imdbIDs.push(t.imdbID);
            directorCounts.set(key, entry);
        })
    );
    const director =
        [...directorCounts.values()]
            .filter((d) => d.withClub + d.onOwn >= 2)
            .sort(
                (a, b) =>
                    b.withClub + b.onOwn - (a.withClub + a.onOwn) || a.name.localeCompare(b.name)
            )[0] ?? null;

    // Words
    const reviews = [
        ...clubReviewsIn(year, sources).filter((r) => sameName(r.member, name)),
        ...logReviews(log, sources.responses),
    ];
    const words: MemberRetrospective['words'] = reviews.length
        ? {
              count: reviews.length,
              longest: longestReview(reviews),
              mostReacted: mostReactedReview(reviews),
              highlights: memberHighlightReviews(reviews),
              hadLogs: anyLoggedIn(year, sources),
          }
        : null;

    // Trophies
    const awarded = trophiesIn(year, sources);
    const received = awarded.filter((t) => sameName(t.recipient, name));
    const given = awarded.filter((t) => t.source === 'club' && sameName(t.awardedBy, name));
    const trophies: MemberRetrospective['trophies'] =
        received.length || given.length ? { received, given } : null;

    // Lists
    const made = sources.lists.filter(
        (list) => sameName(list.owner, name) && instantYear(list.createdAt) === year
    );

    return {
        year,
        inProgress: year >= now.getFullYear(),
        member,
        films: { club, log },
        count,
        scores,
        picks: theirPicks.length ? theirPicks : null,
        breakaway,
        log: logSlide,
        taste,
        director,
        words,
        trophies,
        lists: made.length ? made : null,
        closing: {
            films: count.withClub + count.onOwn,
            averageGiven: scores?.average ?? null,
            favourite: pair?.loved ?? null,
            trophies: received.length,
        },
    };
};

/**
 * The most consecutive weeks, Monday to Sunday, with at least one of these
 * `YYYY-MM-DD` dates in each.
 */
export const longestWeekStreak = (dates: string[]): number => {
    const weeks = [
        ...new Set(
            dates
                .map((date) => {
                    const [y, m, d] = date.split('-').map((part) => parseInt(part, 10));
                    const days = Date.UTC(y, m - 1, d) / 86_400_000;
                    // 1970-01-01 was a Thursday; shifting by three puts week
                    // boundaries on Mondays.
                    return Number.isNaN(days) ? null : Math.floor((days + 3) / 7);
                })
                .filter((week): week is number => week !== null)
        ),
    ].sort((a, b) => a - b);

    let longest = 0;
    let run = 0;
    weeks.forEach((week, i) => {
        run = i > 0 && week === weeks[i - 1] + 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
    });
    return longest;
};
