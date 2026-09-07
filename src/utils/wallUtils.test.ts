import {
    buildWall,
    compareWallEvents,
    formatMonth,
    groupByMonth,
    mergeTrophyRows,
    type ClubWatchEvent,
    type ListEvent,
    type LogEvent,
    type TrophyEvent,
    type WallEvent,
} from './wallUtils';
import type { FilmListDefinition, ListFilmSummary } from '../types/list';
import type { WatchedEntry, WatchedLog } from '../types/watched';
import { makeClubInfo, makeFilm, makeRating, makeTrophy } from '../test-utils/factories';

// The suite runs in US Central (see jest.config.js), which is what makes the
// instant-dated events below assertable.

const clubFilm = makeFilm({
    imdbID: 'tt0000001',
    title: 'A Club Film',
    year: '1999',
    movieClubInfo: makeClubInfo({
        selector: 'Mark',
        watchDate: '08/12/2020',
        clubRatings: [
            makeRating({ user: 'andy', score: 8 }),
            makeRating({ user: 'gabe', score: 5 }),
        ],
    }),
});

const laterClubFilm = makeFilm({
    imdbID: 'tt0000002',
    title: 'A Later Club Film',
    year: '2001',
    movieClubInfo: makeClubInfo({ selector: 'Gabe', watchDate: '09/01/2026', clubRatings: [] }),
});

/** Picked but not yet watched — the sheet leaves the date blank. */
const unwatchedFilm = makeFilm({
    imdbID: 'tt0000003',
    title: 'Not Yet Watched',
    movieClubInfo: makeClubInfo({ watchDate: null, clubRatings: [] }),
});

const films = [clubFilm, laterClubFilm, unwatchedFilm];

const summaries: Record<string, ListFilmSummary> = {
    tt0000009: {
        imdbID: 'tt0000009',
        title: 'A Cached Film',
        year: '1985',
        poster: 'https://example.com/cached.jpg',
    },
};

const logEntry = (overrides: Partial<WatchedEntry> = {}): WatchedEntry => ({
    imdbID: 'tt0000009',
    watchDate: '2026-09-05',
    score: 7,
    scoreQualifier: null,
    blurb: null,
    image: null,
    posterImage: null,
    trailerKey: null,
    hideTrailer: false,
    updatedAt: '2026-09-06T03:54:56Z',
    ...overrides,
});

const watched: WatchedLog = { Gabe: [logEntry()] };

const datedList: FilmListDefinition = {
    id: 'jacob-therapists',
    name: 'Even Your Therapist',
    owner: 'Jacob',
    description: 'When they are all out to get you.',
    ranked: false,
    createdAt: '2026-08-15T23:43:02Z',
    entries: [{ rank: 1, imdbID: 'tt0000009', description: null }],
};

/** A list from before `createdAt` existed. */
const undatedList: FilmListDefinition = {
    id: 'gabe-comfort',
    name: 'Comfort Watches',
    owner: 'Gabe',
    description: null,
    entries: [],
};

const sources = {
    films,
    watched,
    lists: [datedList, undatedList],
    trophies: {},
    summaries,
};

const byId = (events: WallEvent[], id: string) => events.find((event) => event.id === id);

describe('buildWall', () => {
    it('dates a club screening by the sheet date, without drifting a day', () => {
        const event = byId(buildWall(sources), 'club-tt0000001') as ClubWatchEvent;

        expect(event.kind).toBe('club-watch');
        // 08/12/2020, not 08/11/2020 — the bug a UTC-parsed date produces for
        // anyone west of Greenwich, which is everyone in this club.
        expect(event.date).toBe('2020-08-12');
        expect(event.selector).toBe('Mark');
        expect(event.average).toBe(6.5);
        expect(event.film.imdbID).toBe('tt0000001');
    });

    it('leaves a film the club has picked but not watched off the wall', () => {
        expect(byId(buildWall(sources), 'club-tt0000003')).toBeUndefined();
    });

    it('dates a logged film by when it was watched, not when it was typed', () => {
        const event = byId(buildWall(sources), 'log-Gabe-tt0000009') as LogEvent;

        expect(event.kind).toBe('log');
        expect(event.member).toBe('Gabe');
        // The entry was saved on the 6th and watched on the 5th; the wall is a
        // record of what happened, so the 5th is where it goes.
        expect(event.date).toBe('2026-09-05');
        expect(event.at).toBe('2026-09-06T03:54:56Z');
        expect(event.entry.title).toBe('A Cached Film');
    });

    it("keeps a logged score as the member's own, never as a club figure", () => {
        const alsoLogged: WatchedLog = {
            Gabe: [logEntry({ imdbID: 'tt0000001', score: 2 })],
        };
        const event = byId(
            buildWall({ ...sources, watched: alsoLogged }),
            'log-Gabe-tt0000001'
        ) as LogEvent;

        // The club averaged this film at 6.5 above. A log event of the same film
        // carries Gabe's 2 and nothing else — the two records stay independent,
        // which is the whole contract in `types/watched.ts`.
        expect(event.entry.score).toBe(2);
        expect(event.entry.clubFilm?.imdbID).toBe('tt0000001');
        expect(event).not.toHaveProperty('average');
    });

    it("places a list on the day it was created, in the club's own timezone", () => {
        const event = byId(buildWall(sources), 'list-jacob-therapists') as ListEvent;

        expect(event.kind).toBe('list');
        // Stamped 23:43 UTC on the 15th, which is 18:43 Central on the 15th.
        expect(event.date).toBe('2026-08-15');
        expect(event.list.owner).toBe('Jacob');
        expect(event.posters).toEqual(['https://example.com/cached.jpg']);
    });

    it('skips a list written before creation dates were recorded', () => {
        expect(byId(buildWall(sources), 'list-gabe-comfort')).toBeUndefined();
    });

    it('dates a sheet trophy to the screening it was given at', () => {
        const sheetFilm = makeFilm({
            imdbID: 'tt0000010',
            title: 'Trophy Night',
            movieClubInfo: makeClubInfo({
                watchDate: '03/04/2021',
                clubRatings: [],
                trophyNotes: 'Andy gets togetherness trophy',
            }),
        });
        const events = buildWall({ ...sources, films: [sheetFilm] }).filter(
            (event) => event.kind === 'trophy'
        ) as TrophyEvent[];

        expect(events).toHaveLength(1);
        expect(events[0].date).toBe('2021-03-04');
        expect(events[0].at).toBeNull();
        expect(events[0].trophy.recipient).toBe('Andy');
        expect(events[0].trophy.award).toBe('Togetherness trophy');
        expect(events[0].film.imdbID).toBe('tt0000010');
    });

    it('dates a site trophy to when it was awarded, not to the screening', () => {
        const trophy = makeTrophy({
            recipient: 'Joey',
            award: 'Togetherness Award',
            awardedAt: '2026-09-02T04:21:03Z',
        });
        const events = buildWall({
            ...sources,
            trophies: { tt0000001: [trophy] },
        }).filter((event) => event.kind === 'trophy') as TrophyEvent[];

        expect(events).toHaveLength(1);
        // 04:21 UTC is 23:21 Central the evening before — the evening the club
        // was actually watching, which is where the award belongs.
        expect(events[0].date).toBe('2026-09-01');
        expect(events[0].at).toBe('2026-09-02T04:21:03Z');
        expect(events[0].trophy.recipient).toBe('Joey');
    });

    it('reads both trophy writers into one stream', () => {
        const film = makeFilm({
            imdbID: 'tt0000011',
            movieClubInfo: makeClubInfo({
                watchDate: '03/04/2021',
                clubRatings: [],
                trophyNotes: 'Andy gets togetherness trophy',
            }),
        });
        const events = buildWall({
            ...sources,
            films: [film],
            trophies: { tt0000011: [makeTrophy({ recipient: 'Joey', award: 'Bad Boy' })] },
        }).filter((event) => event.kind === 'trophy') as TrophyEvent[];

        expect(events.map((event) => event.trophy.source).sort()).toEqual(['club', 'sheet']);
    });

    it('orders the whole wall newest first', () => {
        const dates = buildWall(sources).map((event) => event.date);
        expect(dates).toEqual([...dates].sort().reverse());
    });

    it('puts a screening above the trophies handed out at it', () => {
        const film = makeFilm({
            imdbID: 'tt0000012',
            movieClubInfo: makeClubInfo({
                watchDate: '03/04/2021',
                clubRatings: [],
                trophyNotes: 'Andy gets togetherness trophy',
            }),
        });
        const kinds = buildWall({ ...sources, films: [film], lists: [], watched: {} }).map(
            (event) => event.kind
        );

        expect(kinds).toEqual(['club-watch', 'trophy']);
    });
});

describe('compareWallEvents', () => {
    const event = (overrides: Partial<WallEvent>): WallEvent =>
        ({
            id: 'x',
            kind: 'log',
            date: '2026-01-01',
            at: null,
            wash: null,
            ...overrides,
        }) as WallEvent;

    it('sorts an event with a recorded instant above one without, on the same day', () => {
        const timed = event({ id: 'timed', at: '2026-01-01T10:00:00Z' });
        const untimed = event({ id: 'untimed', at: null });

        expect([untimed, timed].sort(compareWallEvents).map((e) => e.id)).toEqual([
            'timed',
            'untimed',
        ]);
    });

    it('is a total order, so equal-looking events never reshuffle', () => {
        const a = event({ id: 'a' });
        const b = event({ id: 'b' });

        expect(compareWallEvents(a, b)).toBeLessThan(0);
        expect(compareWallEvents(b, a)).toBeGreaterThan(0);
        expect(compareWallEvents(a, a)).toBe(0);
    });
});

describe('groupByMonth', () => {
    it('cuts the wall into runs without reordering it', () => {
        const months = groupByMonth(buildWall(sources));

        expect(months.map((month) => month.key)).toEqual(['2026-09', '2026-08', '2020-08']);
        expect(months[0].label).toBe('September 2026');
        expect(months.flatMap((month) => month.events)).toEqual(buildWall(sources));
    });

    it('returns nothing for an empty wall', () => {
        expect(groupByMonth([])).toEqual([]);
    });
});

describe('mergeTrophyRows', () => {
    /** A screening and the two awards handed out at it, in wall order. */
    const trophyNight = () =>
        buildWall({
            ...sources,
            lists: [],
            watched: {},
            films: [
                makeFilm({
                    imdbID: 'tt0000020',
                    title: 'Trophy Night',
                    movieClubInfo: makeClubInfo({
                        watchDate: '03/04/2021',
                        clubRatings: [],
                        trophyNotes: 'Andy gets togetherness trophy, Joey gets bad boy award',
                    }),
                }),
            ],
        });

    it("folds a night's awards into the screening they were given at", () => {
        const rows = mergeTrophyRows(trophyNight());

        expect(rows).toHaveLength(1);
        expect(rows[0].lead.kind).toBe('club-watch');
        expect(rows[0].id).toBe('club-tt0000020');
        expect(rows[0].trophies.map((event) => event.trophy.recipient)).toEqual(['Andy', 'Joey']);
    });

    it('leads with the screening even when a timestamped award sorted above it', () => {
        const events = buildWall({
            ...sources,
            lists: [],
            watched: {},
            films: [
                makeFilm({
                    imdbID: 'tt0000021',
                    movieClubInfo: makeClubInfo({ watchDate: '09/01/2026', clubRatings: [] }),
                }),
            ],
            // 04:21 UTC is the evening of the 1st in Central, so this lands on
            // the screening's own day — but with an instant, which sorts it
            // above the screening's null.
            trophies: {
                tt0000021: [makeTrophy({ recipient: 'Joey', awardedAt: '2026-09-02T04:21:03Z' })],
            },
        });
        expect(events.map((event) => event.kind)).toEqual(['trophy', 'club-watch']);

        const rows = mergeTrophyRows(events);
        expect(rows).toHaveLength(1);
        expect(rows[0].lead.kind).toBe('club-watch');
        expect(rows[0].trophies).toHaveLength(1);
    });

    it('leaves an award given long after its screening on its own row', () => {
        const events = buildWall({
            ...sources,
            lists: [],
            watched: {},
            films: [clubFilm],
            // Entered in 2026 for a film the club watched in 2020. Nothing
            // separates the two on this wall, but six years do: folding them
            // would file the award under a day it was not given on.
            trophies: {
                tt0000001: [makeTrophy({ recipient: 'Joey', awardedAt: '2026-09-03T15:00:00Z' })],
            },
        });

        const rows = mergeTrophyRows(events);
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.trophies.length === 0)).toBe(true);
        expect(rows[0].lead.kind).toBe('trophy');
        expect(rows[1].lead.kind).toBe('club-watch');
    });

    it('folds adjacent awards for one film with no screening between them', () => {
        const events = buildWall({
            ...sources,
            lists: [],
            watched: {},
            films: [clubFilm],
            trophies: {
                tt0000001: [
                    makeTrophy({ id: 'a', recipient: 'Joey', awardedAt: '2026-09-03T15:00:00Z' }),
                    makeTrophy({ id: 'b', recipient: 'Andy', awardedAt: '2026-09-03T15:01:00Z' }),
                ],
            },
        });

        const rows = mergeTrophyRows(events);
        expect(rows[0].lead.kind).toBe('trophy');
        expect(rows[0].trophies).toHaveLength(1);
        // The 2020 screening is far below and keeps its own row.
        expect(rows).toHaveLength(2);
    });

    it('hands back every other kind untouched, in the order it was given', () => {
        const events = buildWall(sources);
        const rows = mergeTrophyRows(events);

        expect(rows.map((row) => row.lead)).toEqual(events);
        expect(rows.every((row) => row.trophies.length === 0)).toBe(true);
    });

    it('returns nothing for an empty wall', () => {
        expect(mergeTrophyRows([])).toEqual([]);
    });
});

describe('formatMonth', () => {
    it('names the month the key asked for, not the one before it', () => {
        expect(formatMonth('2026-09')).toBe('September 2026');
        expect(formatMonth('2026-01')).toBe('January 2026');
    });

    it('passes through anything that is not a month key', () => {
        expect(formatMonth('nonsense')).toBe('nonsense');
    });
});
