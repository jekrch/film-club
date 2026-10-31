import { ClubRating, Film, filmData } from '../types/film';
import { FilmListDefinition, filmLists } from '../types/list';
import { trophyIndex, type Trophy } from '../types/trophy';
import { clubThreadId, listThreadId, logThreadId, reviewThreadId } from '../types/responses';
import { capitalizeUserName, getTeamMemberByName } from '../types/team';
import { watchedLog, type WatchedLog } from '../types/watched';
import { parseWatchDate } from './filmUtils';
import {
    collectionFrameImage,
    entryFrameSource,
    filmFrameSource,
    type FrameImage,
} from './frameSources';
import { resolveListEntries } from './listUtils';
import { calculateClubAverage } from './ratingUtils';
import { resolveFilmTrophies, type ResolvedTrophy } from './trophyUtils';
import { resolveWatchedEntry, type ResolvedWatchedEntry } from './watchedUtils';
import type { ListFilmSummary } from '../types/list';

/**
 * The club's shared wall: everything that has happened, in one order.
 *
 * The site already tells each of these stories in its own place — a film's page,
 * a member's log, a list, a trophy shelf — and nowhere says what happened *last*.
 * This module is the join: it reads the four bundled files that record dated
 * activity and flattens them into one stream of {@link WallEvent}.
 *
 * **It reads, and only reads.** Nothing here writes, and nothing here is a new
 * record of anything: an event is a view onto a row that already exists in
 * `films.json`, `watched.json`, `lists.json`, or `trophies.json`. The club/personal
 * divide the rest of the site is built on (see the note atop `types/watched.ts`)
 * survives intact — a `log` event carries a member's private score and a
 * `club-watch` event carries the club's average, and neither can become the
 * other, because they are different members of the union and no code path
 * converts between them. A `late-review` event is a third thing again: a member's
 * own score or words, but on the club's record, where they do count.
 *
 * **Everything is dated by when it happened, not by when it was typed.** A club
 * watch and a member's log both take the *watch* date, which is the date those
 * two surfaces already sort on; if they didn't agree, a wall mixing them would
 * be telling two different stories in one column. A list and a trophy have no
 * date but the one they were recorded at, so for those the two are the same
 * thing, and so it is for a late review: nobody knows when the member saw the
 * film, and the adding is the event. {@link WallEvent.at} carries the recorded
 * instant where there is one, and is only ever a tie-breaker.
 *
 * Everything read here is bundled, so the wall renders for a signed-out visitor
 * with no network round trip — the same reason `lists.json` and `trophies.json`
 * are bundled in the first place. `overrides.json` is deliberately *not* read:
 * it is fetched only for signed-in members, and a wall that grew rows when you
 * signed in would be a different wall per viewer.
 */

/** What kind of thing happened. */
export type WallEventKind = 'club-watch' | 'log' | 'late-review' | 'list' | 'trophy';

interface WallEventBase {
    /** Unique across the whole wall, and stable between builds. */
    id: string;
    kind: WallEventKind;
    /**
     * The day it happened, `YYYY-MM-DD` so it sorts lexicographically — the same
     * reason `WatchedEntry.watchDate` is stored that way.
     */
    date: string;
    /**
     * The instant it was recorded, when one was recorded. Orders events that
     * share a {@link date} and nothing else; a club watch and a sheet trophy
     * have none, since the sheet stored a day and no more.
     */
    at: string | null;
    /** The art washed behind the row, or null for an event whose subject has none. */
    wash: FrameImage | null;
}

/** The club watched a film together. */
export interface ClubWatchEvent extends WallEventBase {
    kind: 'club-watch';
    film: Film;
    /** Whose pick it was, as the sheet recorded it. Null when it never said. */
    selector: string | null;
    /** The club's average, or null when nobody scored it. */
    average: number | null;
}

/** A member logged a film they watched on their own. */
export interface LogEvent extends WallEventBase {
    kind: 'log';
    /** The log's owner, in `club.json` casing. */
    member: string;
    /**
     * Their entry, resolved. The score and review on it are theirs alone and
     * count toward nothing — see the note atop `types/watched.ts`.
     */
    entry: ResolvedWatchedEntry;
}

/**
 * A member added their own score or review to a film the club watched earlier.
 *
 * Its own kind rather than a `log`, because this is the club's record: the score
 * counts toward the film's average, and the row has to say so rather than wear
 * the log's "counts toward nothing".
 */
export interface LateReviewEvent extends WallEventBase {
    kind: 'late-review';
    /** The reviewer, in `club.json` casing. */
    member: string;
    film: Film;
    /** Their row on the film, as it stands now rather than as it was first added. */
    rating: ClubRating;
    /** The day the club watched it, `YYYY-MM-DD`. */
    watchDay: string;
}

/** A member started a list. */
export interface ListEvent extends WallEventBase {
    kind: 'list';
    list: FilmListDefinition;
    /** Posters for the stacked preview, in rank order. Films with none are skipped. */
    posters: string[];
    /**
     * The films at the head of the list, by name, for the row's preview line.
     *
     * The deck of posters beside it is art, not text: it says a list has films
     * on it without saying which, and below `sm` it isn't there at all. Every
     * other kind of row on this wall names what it is about, and until this
     * existed a list was the one that didn't — it said "7 films" and left the
     * reader to open it to find out which seven.
     *
     * A film the caches don't know yet has no name to print and is dropped, so
     * this is the top few *nameable* films rather than strictly ranks 1-3. The
     * count that follows it is figured from the list's own length, so the row
     * still adds up to the whole list either way.
     */
    titles: string[];
}

/** A member was handed a trophy for a film. */
export interface TrophyEvent extends WallEventBase {
    kind: 'trophy';
    trophy: ResolvedTrophy;
    /** The film it was given for — a trophy belongs to a screening. */
    film: Film;
}

export type WallEvent = ClubWatchEvent | LogEvent | LateReviewEvent | ListEvent | TrophyEvent;

/**
 * Optional data overrides. Production callers pass nothing and get the bundled
 * data; tests pass fixtures rather than reaching for module mocks — the same
 * contract `listUtils` and `watchedUtils` offer.
 */
export interface WallDataSources {
    films?: Film[];
    watched?: WatchedLog;
    lists?: FilmListDefinition[];
    /** `trophies.json`'s `films` map. Sheet awards come off the films themselves. */
    trophies?: Record<string, Trophy[]>;
    summaries?: Record<string, ListFilmSummary>;
}

/**
 * `08/12/2020` → `2020-08-12`, the form everything else here is dated in.
 *
 * Goes through `parseWatchDate`, which is what the rest of the site validates
 * the sheet's dates with, and then reads the parts back in UTC — the calendar
 * the date was built in. Reading them locally would shift a date west of
 * Greenwich to the previous day, which is the bug `formatWatchDate` exists to
 * avoid at the other end of the pipe.
 */
const clubDayKey = (watchDate: string | null | undefined): string | null => {
    const parsed = parseWatchDate(watchDate);
    if (!parsed) return null;

    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${parsed.getUTCFullYear()}-${month}-${day}`;
};

/**
 * An ISO instant → the day it fell on *for the reader*.
 *
 * Local rather than UTC, unlike {@link clubDayKey}, and the difference is real:
 * a sheet date is a calendar date the club wrote down, while this is a moment
 * the worker stamped. A trophy given at 9pm Central is stamped past midnight
 * UTC, and filing it under the next day would put it above the film it was
 * given for.
 */
const instantDayKey = (iso: string): string | null => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return null;

    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${parsed.getFullYear()}-${month}-${day}`;
};

/**
 * How same-day events fall when nothing else separates them.
 *
 * A club watch leads its own day, and the trophies handed out at that screening
 * follow it — which is the order the evening actually happened in, and the only
 * one where "Joey won the Togetherness Award" has the film it refers to sitting
 * above it.
 */
const KIND_ORDER: Record<WallEventKind, number> = {
    'club-watch': 0,
    trophy: 1,
    log: 2,
    'late-review': 3,
    list: 4,
};

/**
 * Newest first.
 *
 * Then by recorded instant, so two of a member's logs from the same evening
 * land in the order they were written; an event with no instant sorts after
 * every event that has one, since "we don't know when within the day" is a
 * weaker claim than a timestamp rather than an earlier one. Then by kind, and
 * finally by id, so the order is total and a build can't reshuffle the wall.
 */
export const compareWallEvents = (a: WallEvent, b: WallEvent): number => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.at !== b.at) {
        if (a.at === null) return 1;
        if (b.at === null) return -1;
        return b.at.localeCompare(a.at);
    }
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.id.localeCompare(b.id);
};

/** Every club screening the sheet or the site has a date for. */
const clubWatchEvents = (films: Film[]): ClubWatchEvent[] =>
    films.flatMap((film) => {
        const info = film.movieClubInfo;
        const date = clubDayKey(info?.watchDate);
        // A film the club has picked but not yet watched has no date and is not
        // yet an event. It becomes one the evening it is watched.
        if (!info || !date) return [];

        return [
            {
                id: clubThreadId(film.imdbID),
                kind: 'club-watch' as const,
                date,
                at: null,
                wash: filmFrameSource(film).images[0] ?? null,
                film,
                selector: info.selector?.trim() ? info.selector.trim() : null,
                average: calculateClubAverage(info.clubRatings),
            },
        ];
    });

/** Every film every member has logged on their own. */
const logEvents = (log: WatchedLog, sources: WallDataSources): LogEvent[] =>
    Object.entries(log).flatMap(([member, entries]) =>
        entries.map((entry) => {
            const resolved = resolveWatchedEntry(entry, {
                films: sources.films,
                summaries: sources.summaries,
            });
            return {
                // Also the thread id reactions and comments hang from.
                id: logThreadId(member, entry.imdbID),
                kind: 'log' as const,
                date: entry.watchDate,
                at: entry.updatedAt ?? null,
                wash: entryFrameSource(resolved).images[0] ?? null,
                member,
                entry: resolved,
            };
        })
    );

/**
 * How long after a screening an addition still belongs to that screening.
 *
 * Scores routinely go in the next morning, and that isn't news: the screening's
 * own row already shows them. A week is the shortest gap that clears those while
 * staying under the club's usual gap between films.
 */
const LATE_REVIEW_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant a member first added something to this film after the grace period,
 * or null if they never did.
 *
 * A score from the night and a review from a month later is one late addition, on
 * the review's date. A stamp whose field has since been cleared doesn't count,
 * because the row would have nothing to show for it.
 */
const firstLateAddition = (rating: ClubRating, watchDay: string): string | null => {
    const cutoff = Date.parse(`${watchDay}T00:00:00Z`) + LATE_REVIEW_GRACE_DAYS * DAY_MS;
    const [first] = [
        rating.score !== null ? rating.scoreAddedAt : undefined,
        rating.blurb !== null ? rating.blurbAddedAt : undefined,
    ]
        .filter((stamp): stamp is string => !!stamp && Date.parse(stamp) > cutoff)
        .sort();
    return first ?? null;
};

/**
 * Every score or review a member added to a club film well after the screening.
 *
 * One event per member per film, so a later edit or a review following a late
 * score never adds a second row or moves the first.
 */
const lateReviewEvents = (films: Film[]): LateReviewEvent[] =>
    films.flatMap((film) => {
        const watchDay = clubDayKey(film.movieClubInfo?.watchDate);
        if (!watchDay) return [];

        return (film.movieClubInfo?.clubRatings ?? []).flatMap((rating) => {
            const at = firstLateAddition(rating, watchDay);
            const date = at ? instantDayKey(at) : null;
            if (!at || !date) return [];

            const member =
                getTeamMemberByName(rating.user)?.name ?? capitalizeUserName(rating.user);
            return [
                {
                    // Also the thread id reactions and comments hang from.
                    id: reviewThreadId(member, film.imdbID),
                    kind: 'late-review' as const,
                    date,
                    at,
                    wash: filmFrameSource(film).images[0] ?? null,
                    member,
                    film,
                    rating,
                    watchDay,
                },
            ];
        });
    });

/** How many posters a list event stacks before it stops. Matches the profile's. */
const LIST_PREVIEW_COUNT = 5;

/**
 * How many of a list's films the row names.
 *
 * Three fits one line at the widths this row is read at, and is enough to say
 * what kind of list it is — which is the whole job of the line. A fourth mostly
 * wraps, and a wrapped teaser costs more room than the list's own blurb sitting
 * right under it.
 */
const LIST_TITLE_COUNT = 3;

/**
 * Every list that knows when it was made.
 *
 * A list written before `createdAt` existed has no date and cannot be placed on
 * a chronological wall, so it is skipped rather than guessed at — the one list
 * in that position was backfilled from the commit that created it, and every
 * list since is stamped by the worker on create.
 */
const listEvents = (lists: FilmListDefinition[], sources: WallDataSources): ListEvent[] =>
    lists.flatMap((list) => {
        const date = list.createdAt ? instantDayKey(list.createdAt) : null;
        if (!list.createdAt || !date) return [];

        const entries = resolveListEntries(list, {
            films: sources.films,
            summaries: sources.summaries,
            watched: sources.watched,
        });

        return [
            {
                id: listThreadId(list.id),
                kind: 'list' as const,
                date,
                at: list.createdAt,
                // Drawn from the whole list rather than the rows the stack shows,
                // for the reason the profile's list rows give: a still anywhere
                // on it beats the poster of whatever sits at rank 1.
                wash: collectionFrameImage(entries),
                list,
                posters: entries
                    .map((entry) => entry.poster)
                    .filter((poster): poster is string => poster !== null)
                    .slice(0, LIST_PREVIEW_COUNT),
                titles: entries
                    .map((entry) => entry.title)
                    .filter((title): title is string => title !== null)
                    .slice(0, LIST_TITLE_COUNT),
            },
        ];
    });

/**
 * Every award the club has handed out, from both of the places they are written.
 *
 * `resolveFilmTrophies` is what reads the two — the sheet's prose and the site's
 * structured rows — so the wall doesn't learn that seam. The dates differ
 * though, and that is this function's own work: a site award carries the instant
 * the worker stamped it, while a sheet award carries nothing at all and is dated
 * to the screening it was given at, which is where it was given.
 */
const trophyEvents = (films: Film[], sources: WallDataSources): TrophyEvent[] =>
    films.flatMap((film) => {
        const stored = sources.trophies ? (sources.trophies[film.imdbID] ?? []) : undefined;
        const watchDay = clubDayKey(film.movieClubInfo?.watchDate);
        const wash = filmFrameSource(film).images[0] ?? null;

        return resolveFilmTrophies(film, stored).flatMap((trophy) => {
            const awardedAt = trophy.source === 'club' ? findAwardedAt(film, trophy, stored) : null;
            const date = awardedAt ? instantDayKey(awardedAt) : watchDay;
            // A sheet award on a film with no watch date, which the club has
            // never actually produced — but it would otherwise be an undated row.
            if (!date) return [];

            return [
                {
                    id: `trophy-${film.imdbID}-${trophy.key}`,
                    kind: 'trophy' as const,
                    date,
                    at: awardedAt,
                    wash,
                    trophy,
                    film,
                },
            ];
        });
    });

/**
 * When a site award was given. `ResolvedTrophy` drops `awardedAt` — the
 * galleries that shape it have no use for one — so it is read back off the row
 * the resolution came from, by the id the two share.
 */
const findAwardedAt = (
    film: Film,
    trophy: ResolvedTrophy,
    stored: Trophy[] | undefined
): string | null => {
    const rows = stored ?? trophyIndex.films[film.imdbID] ?? [];
    return rows.find((row) => row.id === trophy.id)?.awardedAt ?? null;
};

/**
 * The whole wall, newest first.
 *
 * Built in one pass over the bundled data rather than incrementally: the club
 * has a hundred-odd events and will have a hundred-odd more in a decade, which
 * is small enough that paging belongs in the page (where the reader can ask for
 * more) rather than here.
 */
export const buildWall = (sources: WallDataSources = {}): WallEvent[] => {
    const films = sources.films ?? filmData;

    return [
        ...clubWatchEvents(films),
        ...logEvents(sources.watched ?? watchedLog, sources),
        ...lateReviewEvents(films),
        ...listEvents(sources.lists ?? filmLists, sources),
        ...trophyEvents(films, sources),
    ].sort(compareWallEvents);
};

/** How far back the home page's teaser reaches, in days. */
const OFF_DOCKET_DAYS = 30;

/** How many members the teaser names at most. */
const OFF_DOCKET_MEMBERS = 3;

/** How many members the teaser reaches past its window to name, when it can. */
const OFF_DOCKET_MIN_MEMBERS = 2;

/** One member's entry in the home page's teaser. */
export interface OffDocketNote {
    member: string;
    /** The name of their newest film or list. */
    subject: string;
    /** How many other logs and lists they have inside the window. */
    more: number;
}

/**
 * What members have been doing outside the club's own selections, for the small
 * piece of the wall the home page shows.
 *
 * Only logs and lists. Screenings already sit right below it as Recent Club
 * Picks, and trophies and late reviews are the club's record, which is exactly
 * what the teaser is labelled as not being.
 *
 * One note per member, newest first, because the log is lopsided: whoever logs
 * most would otherwise fill the line alone. For the same reason, a lone active
 * member gets company: the search carries on past the window until it finds a
 * second name. The window still decides whether there is a teaser at all, so it
 * disappears in a quiet month rather than advertise old news.
 *
 * Expects the wall's own order, newest first, which {@link buildWall} returns.
 */
export const offDocketNotes = (events: WallEvent[], now: Date = new Date()): OffDocketNote[] => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - OFF_DOCKET_DAYS);
    const since = instantDayKey(cutoff.toISOString()) ?? '';

    const notes = new Map<string, OffDocketNote>();
    for (const event of events) {
        const pastWindow = event.date < since;
        if (pastWindow && (notes.size === 0 || notes.size >= OFF_DOCKET_MIN_MEMBERS)) break;

        const note: OffDocketNote | null =
            event.kind === 'log'
                ? // A film logged moments ago may not be in the caches yet.
                  { member: event.member, subject: event.entry.title ?? 'a film', more: 0 }
                : event.kind === 'list'
                  ? { member: event.list.owner, subject: event.list.name, more: 0 }
                  : null;
        if (!note) continue;

        const key = note.member.toLowerCase();
        const newest = notes.get(key);
        if (!newest) notes.set(key, note);
        else if (!pastWindow) newest.more += 1;
    }

    return [...notes.values()].slice(0, OFF_DOCKET_MEMBERS);
};

/** A run of events that fell in one month, in wall order. */
export interface WallMonth {
    /** `YYYY-MM`, which is what the run is keyed and sorted by. */
    key: string;
    /** `September 2026`, for the heading. */
    label: string;
    events: WallEvent[];
}

/**
 * Cuts the wall into months.
 *
 * A wall of a hundred rows needs somewhere for the eye to rest, and a month is
 * the unit this club moves in — it watches something every week or two. The
 * events arrive sorted, so this is a fold rather than a group-and-re-sort.
 */
export const groupByMonth = (events: WallEvent[]): WallMonth[] => {
    const months: WallMonth[] = [];

    events.forEach((event) => {
        const key = event.date.slice(0, 7);
        const last = months[months.length - 1];
        if (last && last.key === key) {
            last.events.push(event);
            return;
        }
        months.push({ key, label: formatMonth(key), events: [event] });
    });

    return months;
};

/**
 * `2026-09` → `September 2026`.
 *
 * Built from the parts for the reason `formatWatchDate` is: `new Date('2026-09')`
 * parses as UTC midnight on the first, which is August for anyone west of
 * Greenwich — and a heading naming the wrong month is worse than most off-by-one
 * date bugs, because every row under it looks misfiled.
 */
export const formatMonth = (key: string): string => {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return key;

    const [, year, month] = match;
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return key;

    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

/** The members and kinds a wall actually contains, for the filter chips. */
export const wallKinds = (events: WallEvent[]): Set<WallEventKind> =>
    new Set(events.map((event) => event.kind));

/**
 * The events a selection of filter chips leaves on the wall.
 *
 * An empty selection means everything rather than nothing: the chips are a way
 * to narrow the wall, and a wall you have narrowed to nothing is never what
 * anyone was reaching for.
 *
 * A late review has no chip and goes with the screenings, since a past club pick
 * is what it's about.
 */
export const narrowWall = (events: WallEvent[], kinds: Set<WallEventKind>): WallEvent[] =>
    kinds.size === 0
        ? events
        : events.filter((event) =>
              kinds.has(event.kind === 'late-review' ? 'club-watch' : event.kind)
          );

/**
 * One box on the wall.
 *
 * Usually an event on its own. But the club hands out its trophies at the
 * screening, so a Friday night arrives here as a screening followed by three
 * awards for the same film — four boxes carrying the same poster, one under the
 * next. {@link mergeTrophyRows} folds those into one.
 */
export interface WallRow {
    /** The lead event's id, so a row is keyed by the record it leads with. */
    id: string;
    /** The event the box is drawn as. */
    lead: WallEvent;
    /**
     * Awards folded in from the boxes below, in wall order, all for the same
     * film as {@link lead}. Empty on every row that stands alone.
     */
    trophies: TrophyEvent[];
}

/** The film an event is about, or null for a list, which is about several. */
const eventFilmId = (event: WallEvent): string | null => {
    switch (event.kind) {
        case 'club-watch':
        case 'trophy':
            return event.film.imdbID;
        // A late review is dated apart from its screening by at least a week, and
        // it is one member's row rather than part of the evening.
        case 'late-review':
        case 'log':
        case 'list':
            return null;
    }
};

/**
 * Folds each run of adjacent same-film screening-and-trophy events into one row.
 *
 * Adjacent *and* on one day, and both halves of that matter: the wall is a
 * chronology, so folding across an intervening event or across a date boundary
 * would move a record to a place it didn't happen. A trophy the club added to a
 * film years after watching it therefore keeps its own row up at the day it was
 * added — which is where it belongs, and which is where it would stop being
 * findable if it were folded into a screening from 2020 — while the three handed
 * out on the night collapse into the screening they were handed out at.
 *
 * A run leads with its screening wherever it has one, even when a timestamped
 * award sorted above it: the screening is the event the others are about, and a
 * box titled "The club watched X" with its awards beneath reads the way the
 * evening went. A run of trophies with no screening — the film was watched
 * years ago, the awards were entered today — leads with its first award.
 *
 * Runs are found rather than grouped by key, so this is a single pass and the
 * order it is handed is the order it gives back.
 */
export const mergeTrophyRows = (events: WallEvent[]): WallRow[] => {
    const rows: WallRow[] = [];

    for (let index = 0; index < events.length; ) {
        const event = events[index];
        const filmId = eventFilmId(event);

        if (filmId === null) {
            rows.push({ id: event.id, lead: event, trophies: [] });
            index += 1;
            continue;
        }

        let end = index + 1;
        while (
            end < events.length &&
            eventFilmId(events[end]) === filmId &&
            events[end].date === event.date
        ) {
            end += 1;
        }

        const run = events.slice(index, end);
        const screening = run.find(
            (member): member is ClubWatchEvent => member.kind === 'club-watch'
        );
        const lead = screening ?? run[0];
        rows.push({
            id: lead.id,
            lead,
            trophies: run.filter((member): member is TrophyEvent => member !== lead),
        });
        index = end;
    }

    return rows;
};
