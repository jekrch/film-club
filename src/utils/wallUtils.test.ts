import {
    buildWall,
    compareWallEvents,
    formatMonth,
    groupByMonth,
    mergeTrophyRows,
    narrowWall,
    offDocketNotes,
    type ClubWatchEvent,
    type LateReviewEvent,
    type ListEvent,
    type LogEvent,
    type TrophyEvent,
    type WallEvent,
} from './wallUtils';
import type { ClubRating, Film } from '../types/film';
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

describe('offDocketNotes', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    const notesFor = (log: WatchedLog, lists: FilmListDefinition[] = [], at: Date = now) =>
        offDocketNotes(buildWall({ ...sources, watched: log, lists }), at);

    it('names a member once, by their newest film, and counts the rest', () => {
        const notes = notesFor({
            Jacob: [
                logEntry({ imdbID: 'tt0000010', watchDate: '2026-09-10' }),
                logEntry({ imdbID: 'tt0000009', watchDate: '2026-09-15' }),
                logEntry({ imdbID: 'tt0000011', watchDate: '2026-09-05' }),
            ],
        });

        expect(notes).toEqual([{ member: 'Jacob', subject: 'A Cached Film', more: 2 }]);
    });

    it('leaves anything outside the window out of the count', () => {
        const notes = notesFor({
            Gabe: [
                logEntry({ imdbID: 'tt0000009', watchDate: '2026-06-01' }),
                logEntry({ imdbID: 'tt0000010', watchDate: '2026-05-01' }),
            ],
            Jacob: [
                logEntry({ imdbID: 'tt0000009', watchDate: '2026-09-15' }),
                logEntry({ imdbID: 'tt0000010', watchDate: '2026-07-01' }),
            ],
        });

        expect(notes.map((note) => [note.member, note.more])).toEqual([
            ['Jacob', 0],
            ['Gabe', 0],
        ]);
    });

    it('orders members by their newest event and names at most three', () => {
        const notes = notesFor({
            Andy: [logEntry({ watchDate: '2026-09-01' })],
            Gabe: [logEntry({ watchDate: '2026-09-15' })],
            Jacob: [logEntry({ watchDate: '2026-09-10' })],
            Mark: [logEntry({ watchDate: '2026-09-05' })],
        });

        expect(notes.map((note) => note.member)).toEqual(['Gabe', 'Jacob', 'Mark']);
    });

    it('leaves out screenings, trophies and late reviews', () => {
        expect(notesFor({})).toEqual([]);
    });

    it('stops at thirty days once two members are named, and keeps the day itself', () => {
        const notes = notesFor({
            Andy: [logEntry({ watchDate: '2026-08-20' })],
            Gabe: [logEntry({ watchDate: '2026-08-21' })],
            Jacob: [logEntry({ watchDate: '2026-09-15' })],
        });

        expect(notes.map((note) => note.member)).toEqual(['Jacob', 'Gabe']);
    });

    it('reaches past the window for a second member, and no further', () => {
        const notes = notesFor({
            Andy: [logEntry({ watchDate: '2026-03-01' })],
            Gabe: [logEntry({ watchDate: '2026-06-01' })],
            Jacob: [logEntry({ watchDate: '2026-09-15' })],
        });

        expect(notes.map((note) => note.member)).toEqual(['Jacob', 'Gabe']);
    });

    it('stays empty when nobody has been active inside the window', () => {
        const notes = notesFor({
            Gabe: [logEntry({ watchDate: '2026-06-01' })],
            Jacob: [logEntry({ watchDate: '2026-07-01' })],
        });

        expect(notes).toEqual([]);
    });

    it('names a list when that is the newest thing a member did', () => {
        const notes = notesFor({ Jacob: [logEntry({ watchDate: '2026-09-15' })] }, [
            { ...datedList, createdAt: '2026-09-18T15:00:00Z' },
        ]);

        expect(notes).toEqual([{ member: 'Jacob', subject: 'Even Your Therapist', more: 1 }]);
    });

    it('falls back when a film has no title yet', () => {
        const notes = notesFor({
            Gabe: [logEntry({ imdbID: 'tt9999999', watchDate: '2026-09-15' })],
        });

        expect(notes[0].subject).toBe('a film');
    });
});

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

    it('names the films at the head of a list, and skips the ones it cannot', () => {
        const named: FilmListDefinition = {
            ...datedList,
            entries: [
                { rank: 1, imdbID: 'tt0000001', description: null },
                // Neither the club's films nor the summary cache knows this one:
                // a row added from another device a moment ago, and all CI has
                // enriched since is nothing. It has no name to print.
                { rank: 2, imdbID: 'tt9999999', description: null },
                { rank: 3, imdbID: 'tt0000009', description: null },
                { rank: 4, imdbID: 'tt0000002', description: null },
            ],
        };
        const event = byId(
            buildWall({ ...sources, lists: [named] }),
            'list-jacob-therapists'
        ) as ListEvent;

        // Three names, in rank order, with the nameless entry passed over rather
        // than printed blank — and stopping at three even though a fourth film
        // is known, so the row's line stays a line.
        expect(event.titles).toEqual(['A Club Film', 'A Cached Film', 'A Later Club Film']);
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

describe('late reviews', () => {
    /** Screened 08/12/2020, so anything past 08/19/2020 UTC is late. */
    const filmWith = (rating: Partial<ClubRating>) =>
        makeFilm({
            imdbID: 'tt0000001',
            title: 'A Club Film',
            movieClubInfo: makeClubInfo({
                selector: 'Mark',
                watchDate: '08/12/2020',
                clubRatings: [makeRating({ user: 'gabe', score: null, blurb: null, ...rating })],
            }),
        });

    const lateReviews = (film: Film) =>
        buildWall({ films: [film], watched: {}, lists: [], trophies: {}, summaries }).filter(
            (event): event is LateReviewEvent => event.kind === 'late-review'
        );

    it('files a net new score and review on the day they were added', () => {
        const [event, ...rest] = lateReviews(
            filmWith({
                score: 8,
                blurb: 'So many haunting scenes.',
                scoreAddedAt: '2026-10-27T12:22:35Z',
                blurbAddedAt: '2026-10-27T12:22:35Z',
            })
        );

        expect(rest).toEqual([]);
        expect(event).toMatchObject({
            id: 'review-Gabe-tt0000001',
            member: 'Gabe',
            date: '2026-10-27',
            at: '2026-10-27T12:22:35Z',
            watchDay: '2020-08-12',
        });
    });

    it('uses the day the addition fell on for the reader, not in UTC', () => {
        // 9:50pm on the 30th in Central, though already the 31st in UTC.
        const [event] = lateReviews(filmWith({ score: 4, scoreAddedAt: '2026-10-31T02:50:46Z' }));
        expect(event.date).toBe('2026-10-30');
    });

    it('stays on the first addition when a review follows a late score', () => {
        const events = lateReviews(
            filmWith({
                score: 8,
                blurb: 'Came back to this.',
                scoreAddedAt: '2026-10-01T12:00:00Z',
                blurbAddedAt: '2026-10-20T12:00:00Z',
            })
        );

        expect(events.map((event) => event.date)).toEqual(['2026-10-01']);
    });

    it('dates a late review by the review when the score came on the night', () => {
        const [event] = lateReviews(
            filmWith({
                score: 8,
                blurb: 'Came back to this.',
                scoreAddedAt: '2020-08-13T04:00:00Z',
                blurbAddedAt: '2026-10-14T12:00:00Z',
            })
        );

        expect(event.date).toBe('2026-10-14');
    });

    it('leaves additions from around the screening to the screening row', () => {
        expect(
            lateReviews(
                filmWith({
                    score: 8,
                    blurb: 'Great night.',
                    scoreAddedAt: '2020-08-13T04:00:00Z',
                    blurbAddedAt: '2020-08-18T23:00:00Z',
                })
            )
        ).toEqual([]);
    });

    it('ignores a row with no stamps, which is everything from the sheet', () => {
        expect(lateReviews(filmWith({ score: 8, blurb: 'From the sheet.' }))).toEqual([]);
    });

    it('ignores a stamp whose field has since been cleared', () => {
        expect(
            lateReviews(
                filmWith({ score: null, blurb: null, scoreAddedAt: '2026-10-27T12:22:35Z' })
            )
        ).toEqual([]);
    });

    it('needs a screening to be late for', () => {
        const unwatched = makeFilm({
            imdbID: 'tt0000003',
            movieClubInfo: makeClubInfo({
                watchDate: null,
                clubRatings: [makeRating({ user: 'gabe', scoreAddedAt: '2026-10-27T12:22:35Z' })],
            }),
        });

        expect(lateReviews(unwatched)).toEqual([]);
    });

    it('never folds into a trophy or a screening', () => {
        const events = lateReviews(filmWith({ score: 8, scoreAddedAt: '2026-10-27T12:22:35Z' }));
        const [row] = mergeTrophyRows(events);

        expect(row.lead.kind).toBe('late-review');
        expect(row.trophies).toEqual([]);
    });

    it('goes with the screenings when the wall is narrowed', () => {
        const events = buildWall({
            films: [filmWith({ score: 8, scoreAddedAt: '2026-10-27T12:22:35Z' })],
            watched,
            lists: [],
            trophies: {},
            summaries,
        });
        const kindsUnder = (kind: WallEvent['kind']) =>
            narrowWall(events, new Set([kind])).map((event) => event.kind);

        expect(kindsUnder('club-watch')).toEqual(['late-review', 'club-watch']);
        expect(kindsUnder('log')).toEqual(['log']);
        expect(narrowWall(events, new Set())).toEqual(events);
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
