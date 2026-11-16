import {
    buildClubRetrospective,
    buildMemberRetrospective,
    busiestMonth,
    longestWeekStreak,
    yearsWithData,
    type RetrospectiveSources,
} from './retrospectiveUtils';
import { awardKey } from './trophyUtils';
import { CLUB_JOINED } from '../config/retrospective';
import type { ClubRating, Film } from '../types/film';
import type { FilmListDefinition, ListFilmSummary } from '../types/list';
import { clubThreadId, listThreadId, logThreadId, reviewThreadId } from '../types/responses';
import type { WatchedEntry } from '../types/watched';
import {
    makeClubInfo,
    makeFilm,
    makeMember,
    makeRating,
    makeTrophy,
} from '../test-utils/factories';

// The suite runs in US Central (see jest.config.js), so an instant a few hours
// past midnight UTC on New Year's Day is still the old year here.

const NOW = new Date('2026-11-14T12:00:00Z');

/** Four members' scores, in the order andy, gabe, jacob, joey. */
const four = (andy: number, gabe: number, jacob: number, joey: number): ClubRating[] => [
    makeRating({ user: 'andy', score: andy }),
    makeRating({ user: 'gabe', score: gabe }),
    makeRating({ user: 'jacob', score: jacob }),
    makeRating({ user: 'joey', score: joey }),
];

/** A club film with no stray credits, so the people slides count only what a test sets. */
const film = (
    imdbID: string,
    title: string,
    watchDate: string | null,
    selector: string,
    clubRatings: ClubRating[],
    overrides: Partial<Film> = {}
): Film =>
    makeFilm({
        imdbID,
        title,
        director: '',
        writer: '',
        actors: '',
        movieClubInfo: makeClubInfo({ selector, watchDate, clubRatings }),
        ...overrides,
    });

// --- 2025 ---------------------------------------------------------------

const lastOf2025 = film('tt2500001', 'Last of 2025', '12/31/25', 'Joey', [
    ...four(6, 6, 6, 6),
    // A late review, added in 2026 to a 2025 film: it counts as 2026 writing.
]);
lastOf2025.movieClubInfo!.clubRatings[1] = makeRating({
    user: 'gabe',
    score: 6,
    blurb: 'Came back to this one.',
    blurbAddedAt: '2026-02-01T12:00:00Z',
});
const midOf2025 = film(
    'tt2500002',
    'Mid 2025',
    '06/01/2025',
    'Andy',
    [...four(5, 5, 5, 4).map((r) => (r.user === 'andy' ? { ...r, blurb: 'Old words.' } : r))],
    // Both are back in 2026, on Irma Vep.
    { director: 'Olivier Assayas', actors: 'Jean-Pierre Léaud' }
);

// --- 2026 ---------------------------------------------------------------

const irma = film('tt2600001', 'Irma Vep', '1/2/26', 'Jacob', four(7, 4.5, 7, 7), {
    runtime: '97 min',
    year: '1996',
    country: 'France',
    language: 'French, English',
    director: 'Olivier Assayas',
    actors: 'Maggie Cheung, Jean-Pierre Léaud',
    cast: [
        { name: 'Maggie Cheung', character: 'Maggie' },
        { name: 'Jean-Pierre Léaud', character: 'René Vidal' },
    ],
});
const narcissus = film('tt2600002', 'Black Narcissus', '1/15/26', 'Andy', four(5, 5, 4.5, 7), {
    year: '1947',
    country: 'United Kingdom',
    director: 'Michael Powell, Emeric Pressburger',
});
const fisher = film('tt2600003', 'The Fisher King', '3/24/26', 'Joey', four(7, 8, 7.5, 7), {
    year: '1991',
    director: 'Terry Gilliam',
});
const z = film('tt2600004', 'Z', '6/11/26', 'Andy', four(7, 7, 8, 6.5), {
    year: '1969',
    country: 'France',
    director: 'Costa-Gavras',
});
z.movieClubInfo!.trophyNotes = 'Joey gets togetherness trophy';
const odyssey = film(
    'tt2600005',
    'The Odyssey',
    '8/6/26',
    '',
    [
        makeRating({ user: 'andy', score: 6 }),
        makeRating({ user: 'gabe', score: 6.5 }),
        makeRating({ user: 'jacob', score: 3, blurb: 'Too loud.' }),
        makeRating({ user: 'joey', score: 6.5 }),
        makeRating({ user: 'greg', score: 6.8 }),
    ],
    { year: '2026', popcornPod: true }
);
const nadja = film(
    'tt2600006',
    'Nadja',
    '10/13/2026',
    'Jacob',
    [
        makeRating({ user: 'joey', score: 2 }),
        makeRating({ user: 'andy', score: 3.5 }),
        makeRating({
            user: 'jacob',
            score: 5.5,
            blurb: 'A vampire film that forgets it is one, and is better for it.',
            blurbAddedAt: '2026-10-14T04:00:00Z',
        }),
        makeRating({ user: 'gabe', score: 3 }),
    ],
    { year: '1994', actors: 'Maggie Cheung' }
);
const unanimous = film('tt2600007', 'All Fives', '11/02/2026', 'Gabe', four(5, 5, 5, 5), {
    year: '1963',
});
const upcoming = film('tt2600008', 'Up Next', null, 'Gabe', []);

const films2026 = [irma, narcissus, fisher, z, odyssey, nadja, unanimous];
const films = [midOf2025, lastOf2025, ...films2026, upcoming];

// --- Logs ---------------------------------------------------------------

const entry = (overrides: Partial<WatchedEntry>): WatchedEntry => ({
    imdbID: 'tt0000000',
    watchDate: '2026-01-01',
    score: null,
    scoreQualifier: null,
    blurb: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
});

const summaries: Record<string, ListFilmSummary> = {
    tt9000000: { imdbID: 'tt9000000', title: 'Logged in 2025', year: '1980', poster: null },
    tt9000001: {
        imdbID: 'tt9000001',
        title: 'The Thing',
        year: '1982',
        poster: 'https://example.com/thing.jpg',
        runtime: '109 min',
        genre: 'Horror, Sci-Fi',
        director: 'John Carpenter',
    },
    tt9000002: {
        imdbID: 'tt9000002',
        title: 'Halloween',
        year: '1978',
        poster: null,
        runtime: '91 min',
        genre: 'Horror',
        director: 'John Carpenter',
    },
    tt9000004: {
        imdbID: 'tt9000004',
        title: 'Shared Film',
        year: '2001',
        poster: null,
        runtime: '100 min',
        genre: 'Drama',
        director: 'Someone Else',
    },
};

const jacobLog: WatchedEntry[] = [
    entry({ imdbID: 'tt9000004', watchDate: '2026-03-02', score: 7 }),
    // A club film, logged again on his own: still a log entry.
    entry({ imdbID: fisher.imdbID, watchDate: '2026-01-15' }),
    entry({ imdbID: 'tt9000002', watchDate: '2026-01-08', score: 6 }),
    entry({ imdbID: 'tt9000001', watchDate: '2026-01-01', score: 8, blurb: 'one two three' }),
    entry({ imdbID: 'tt9000000', watchDate: '2025-12-31', score: 9, blurb: 'Last year.' }),
];
const gabeLog: WatchedEntry[] = [
    entry({ imdbID: 'tt9000004', watchDate: '2026-05-05', score: 4, blurb: 'a b c d e f' }),
];

// --- Trophies, lists, responses ------------------------------------------

const trophies = {
    // A site award in 2026 for a 2025 film: counts by when it was handed out.
    [midOf2025.imdbID]: [
        makeTrophy({
            recipient: 'Gabe',
            award: 'Bad Boy Trophy',
            awardedBy: 'Jacob',
            awardedAt: '2026-03-01T18:00:00Z',
        }),
    ],
    // 9pm New Year's Eve in Chicago: 2025's, not 2026's.
    [irma.imdbID]: [
        makeTrophy({
            recipient: 'Andy',
            award: 'Special Connection Award',
            awardedBy: 'Jacob',
            awardedAt: '2026-01-01T03:00:00Z',
        }),
    ],
    [fisher.imdbID]: [
        makeTrophy({
            recipient: 'Joey',
            award: 'Togetherness Award',
            awardedBy: 'Andy',
            awardedAt: '2026-03-25T02:00:00Z',
        }),
    ],
};

const list = (id: string, owner: string, createdAt: string): FilmListDefinition => ({
    id,
    name: `List ${id}`,
    owner,
    description: null,
    createdAt,
    entries: [],
});
const lists = [
    list('jacob-2026', 'Jacob', '2026-04-01T12:00:00Z'),
    list('jacob-2025', 'Jacob', '2025-04-01T12:00:00Z'),
    // New Year's Eve in Chicago.
    list('gabe-nye', 'Gabe', '2027-01-01T03:00:00Z'),
];

const responses = {
    threads: {
        [logThreadId('Jacob', 'tt9000001')]: {
            reactions: { love: ['Gabe', 'Andy', 'Joey'] },
            comments: [],
        },
        [reviewThreadId('Jacob', nadja.imdbID)]: { reactions: { like: ['Gabe'] }, comments: [] },
        [clubThreadId(fisher.imdbID)]: {
            reactions: { fire: ['Andy', 'Gabe', 'Joey', 'Jacob'] },
            comments: [],
        },
        [listThreadId('jacob-2026')]: { reactions: { clap: ['Joey'] }, comments: [] },
        // On a 2025 log entry: not this year's.
        [logThreadId('Jacob', 'tt9000000')]: {
            reactions: { love: ['Gabe', 'Andy', 'Joey', 'Mark', 'Greg'] },
            comments: [],
        },
    },
};

const members = [
    makeMember({ name: 'Andy', queue: 3 }),
    makeMember({ name: 'Gabe', queue: 4 }),
    makeMember({ name: 'Jacob', queue: 2 }),
    makeMember({ name: 'Joey', queue: 1 }),
    makeMember({ name: 'Mark' }),
    makeMember({ name: 'Greg' }),
];

const sources: RetrospectiveSources = {
    films,
    watched: { Jacob: jacobLog, Gabe: gabeLog, Andy: [] },
    summaries,
    trophies,
    responses,
    lists,
    members,
};

const club2026 = () => buildClubRetrospective(2026, sources, NOW);
const jacob2026 = () => buildMemberRetrospective(2026, 'jacob', sources, NOW)!;

// ---------------------------------------------------------------------------

describe('yearsWithData', () => {
    it('lists every year with a screening or a log entry', () => {
        expect(yearsWithData(sources)).toEqual([2025, 2026]);
    });
});

describe('buildClubRetrospective', () => {
    it('counts the year by watch date, flags pods, and compares with the year before', () => {
        const report = club2026();
        expect(report.films.map((f) => f.title)).toEqual(films2026.map((f) => f.title));
        expect(report.count).toEqual({
            films: 7,
            minutes: 697,
            fullyScored: 7,
            previousYear: 2,
        });
    });

    it('puts a film watched 12/31/25 in 2025, not 2026', () => {
        expect(club2026().films.map((f) => f.imdbID)).not.toContain(lastOf2025.imdbID);
        expect(buildClubRetrospective(2025, sources, NOW).films.map((f) => f.imdbID)).toEqual([
            midOf2025.imdbID,
            lastOf2025.imdbID,
        ]);
    });

    it('says whether the year is still running', () => {
        expect(club2026().inProgress).toBe(true);
        expect(buildClubRetrospective(2025, sources, NOW).inProgress).toBe(false);
    });

    it('finds the busiest month and the longest gap between screenings', () => {
        const { calendar } = club2026();
        expect(calendar!.busiestMonth).toEqual({ months: [0], count: 2 });
        expect(calendar!.longestGap).toMatchObject({ days: 79 });
        expect(calendar!.longestGap!.from.imdbID).toBe(fisher.imdbID);
        expect(calendar!.longestGap!.to.imdbID).toBe(z.imdbID);
        expect(calendar!.first.imdbID).toBe(irma.imdbID);
        expect(calendar!.last.imdbID).toBe(unanimous.imdbID);
    });

    it('reads countries, languages and decades the way the almanac does', () => {
        const { places } = club2026();
        expect(places!.countries[0]).toMatchObject({ name: 'USA', y: 4 });
        expect(places!.countries.find((c) => c.name === 'France')).toMatchObject({ y: 2 });
        expect(places!.languages.find((l) => l.name === 'French')).toMatchObject({ y: 1 });
        expect(places!.decades[0].name).toBe('1940s');
        expect(places!.oldest.imdbID).toBe(narcissus.imdbID);
        expect(places!.newest.imdbID).toBe(odyssey.imdbID);
    });

    it('averages the release years and sets countries and the average against the year before', () => {
        const { places } = club2026();
        // 1996, 1947, 1991, 1969, 2026, 1994, 1963 → 1983.7
        expect(places!.averageYear).toBe(1984);
        // Both 2025 films take the factory's USA and 2020.
        expect(places!.previousYear).toEqual({ countries: 1, averageYear: 2020 });
        expect(buildClubRetrospective(2025, sources, NOW).places!.previousYear).toBeNull();
    });

    it('sets out what each member loved and least loved, without ranking anyone', () => {
        const { favourites } = club2026();
        expect(
            favourites!.map((f) => [
                f.member.name,
                f.loved.film.imdbID,
                f.loved.score,
                f.leastLoved?.film.imdbID,
                f.leastLoved?.score,
            ])
        ).toEqual([
            // Andy's 7s are a three-way tie; the earliest screening wins it.
            ['Andy', irma.imdbID, 7, nadja.imdbID, 3.5],
            ['Gabe', fisher.imdbID, 8, nadja.imdbID, 3],
            ['Jacob', z.imdbID, 8, odyssey.imdbID, 3],
            ['Joey', irma.imdbID, 7, nadja.imdbID, 2],
        ]);
    });

    it('finds what the members loved most and least together, guests aside', () => {
        const { together } = club2026();
        // The Fisher King: (7 + 8 + 7.5 + 7) / 4. Nadja: (2 + 3.5 + 5.5 + 3) / 4.
        expect(together!.loved.film.imdbID).toBe(fisher.imdbID);
        expect(together!.loved.average).toBeCloseTo(7.375);
        expect(together!.leastLoved!.film.imdbID).toBe(nadja.imdbID);
        expect(together!.leastLoved!.average).toBeCloseTo(3.5);
    });

    it('lists who picked what, in screening order, leaving pods out', () => {
        const { selections } = club2026();
        expect(selections!.map((p) => [p.selector, p.films.map((f) => f.imdbID)])).toEqual([
            ['Jacob', [irma.imdbID, nadja.imdbID]],
            ['Andy', [narcissus.imdbID, z.imdbID]],
            ['Joey', [fisher.imdbID]],
            ['Gabe', [unanimous.imdbID]],
        ]);
    });

    it('counts trophies by when they were given, sheet awards by their screening', () => {
        const { trophies: t } = club2026();
        expect(t!.total).toBe(3);
        expect(awardKey(t!.mostGiven.award)).toBe('togetherness');
        expect(t!.mostGiven.count).toBe(2);
        expect(t!.topRecipient).toEqual({ recipient: 'Joey', count: 2 });
        // The New Year's Eve award went to 2025.
        expect(t!.trophies.map((x) => x.recipient)).not.toContain('Andy');
        expect(buildClubRetrospective(2025, sources, NOW).trophies!.trophies[0].recipient).toBe(
            'Andy'
        );
    });

    it('counts log entries off the docket, and the film two members logged', () => {
        const { offDocket } = club2026();
        expect(offDocket!.entries).toBe(5);
        expect(offDocket!.byMember).toEqual([
            { name: 'Jacob', count: 4 },
            { name: 'Gabe', count: 1 },
        ]);
        expect(offDocket!.sharedFilms).toEqual([
            {
                imdbID: 'tt9000004',
                title: 'Shared Film',
                poster: null,
                members: ['Gabe', 'Jacob'],
            },
        ]);
    });

    it('counts a member a review says they watched it with as having logged it too', () => {
        const withCompany = (blurb: string) => ({
            ...sources,
            watched: {
                ...sources.watched,
                Jacob: jacobLog.map((e) => (e.imdbID === 'tt9000004' ? { ...e, blurb } : e)),
            },
        });
        const { offDocket } = buildClubRetrospective(
            2026,
            withCompany('Saw it at the Heights with Jenny, Greg, and Joey. Lovely time.'),
            NOW
        );
        // Joey and Greg, the intern; Jenny isn't in the club.
        expect(offDocket!.entries).toBe(7);
        expect(offDocket!.byMember).toEqual([
            { name: 'Jacob', count: 4 },
            { name: 'Gabe', count: 1 },
            { name: 'Greg', count: 1 },
            { name: 'Joey', count: 1 },
        ]);
        expect(offDocket!.sharedFilms.map((f) => f.members)).toEqual([
            ['Gabe', 'Greg', 'Jacob', 'Joey'],
        ]);

        // A name outside the "with" clause is not company.
        const named = buildClubRetrospective(
            2026,
            withCompany('Joey would hate this. I watched it with my sister.'),
            NOW
        ).offDocket!;
        expect(named.entries).toBe(5);
        expect(named.sharedFilms.map((f) => f.members)).toEqual([['Gabe', 'Jacob']]);
    });

    it('lists every film more than one member saw, most members first, then earliest', () => {
        const blurbs: Record<string, string> = {
            tt9000001: 'With Joey.',
            tt9000002: 'Saw it with Joey and Andy.',
            [fisher.imdbID]: 'With Andy.',
        };
        const { offDocket } = buildClubRetrospective(
            2026,
            {
                ...sources,
                watched: {
                    ...sources.watched,
                    Jacob: jacobLog.map((e) =>
                        blurbs[e.imdbID] ? { ...e, blurb: blurbs[e.imdbID] } : e
                    ),
                },
            },
            NOW
        );
        expect(offDocket!.sharedFilms.map((f) => [f.title, f.members])).toEqual([
            ['Halloween', ['Andy', 'Jacob', 'Joey']],
            // Two each: the one two members logged themselves leads, then by date.
            ['Shared Film', ['Gabe', 'Jacob']],
            ['The Thing', ['Jacob', 'Joey']],
            ['The Fisher King', ['Andy', 'Jacob']],
        ]);
    });

    it('collects the year’s reviews, club and personal, dated by when they were written', () => {
        const { words } = club2026();
        // Nadja's and The Odyssey's, the late one on a 2025 film, and two log reviews.
        expect(words!.count).toBe(5);
        expect(words!.club).toBe(3);
        expect(words!.log).toBe(2);
        expect(words!.longest).toMatchObject({ imdbID: nadja.imdbID, member: 'Jacob' });
        expect(words!.mostReacted).toMatchObject({
            source: 'log',
            imdbID: 'tt9000001',
            reactions: 3,
        });
        // Fullest first, one from each member before a second from
        // anyone. Too few run past a sentence, so short ones are kept.
        expect(words!.highlights.map((r) => [r.member, r.imdbID])).toEqual([
            ['Jacob', nadja.imdbID],
            ['Gabe', 'tt9000004'],
            ['Jacob', 'tt9000001'],
            ['Gabe', lastOf2025.imdbID],
        ]);
    });

    it('dates reactions by what they were left on', () => {
        const { reactions } = club2026();
        expect(reactions!.total).toBe(3 + 1 + 4 + 1);
        expect(reactions!.topReaction).toEqual({ key: 'fire', count: 4 });
        expect(reactions!.topThread.count).toBe(4);
        expect(reactions!.topThread.subject).toMatchObject({
            kind: 'club',
            imdbID: fisher.imdbID,
        });
    });

    it('names the repeat artists, with their role and part on each film', () => {
        const { faces } = club2026();
        expect(faces).toHaveLength(1);
        expect(faces![0].name).toBe('Maggie Cheung');
        expect(faces![0].credits.map((c) => [c.film.imdbID, c.roles, c.character])).toEqual([
            // Irma Vep's cast names her part; Nadja's has no cast list.
            [irma.imdbID, ['Actor'], 'Maggie'],
            [nadja.imdbID, ['Actor'], undefined],
        ]);
    });

    it('finds people the club had met on earlier years’ films', () => {
        const { returning } = club2026();
        expect(
            returning!.map((r) => [
                r.name,
                r.now.map((c) => [c.film.imdbID, c.roles]),
                r.before.map((c) => [c.film.imdbID, c.roles, c.year]),
            ])
        ).toEqual([
            // A director outweighs an actor at the same count.
            [
                'Olivier Assayas',
                [[irma.imdbID, ['Director']]],
                [[midOf2025.imdbID, ['Director'], 2025]],
            ],
            [
                'Jean-Pierre Léaud',
                [[irma.imdbID, ['Actor']]],
                [[midOf2025.imdbID, ['Actor'], 2025]],
            ],
        ]);
    });

    it('lists active members with a report on the closing slide', () => {
        expect(club2026().roster.map((m) => m.name)).toEqual(['Andy', 'Gabe', 'Jacob', 'Joey']);
    });

    it('mentions the intern in passing, and nobody else off the roster', () => {
        expect(club2026().guests.map((g) => [g.member.name, g.films.map((f) => f.imdbID)])).toEqual(
            [['Greg', [odyssey.imdbID]]]
        );
    });

    it('leaves every slide null for a year with nothing in it', () => {
        const report = buildClubRetrospective(2024, sources, NOW);
        const { year, inProgress, films: f, roster, guests, ...slides } = report;
        expect(year).toBe(2024);
        expect(inProgress).toBe(false);
        expect(f).toEqual([]);
        expect(roster).toEqual([]);
        expect(guests).toEqual([]);
        Object.values(slides).forEach((slide) => expect(slide).toBeNull());
    });

    it('never lets a log entry change a club figure', () => {
        const withLogs = club2026();
        const withoutLogs = buildClubRetrospective(2026, { ...sources, watched: {} }, NOW);
        const clubFields = [
            'films',
            'count',
            'calendar',
            'places',
            'favourites',
            'together',
            'returning',
            'selections',
            'trophies',
            'faces',
        ] as const;
        clubFields.forEach((field) => expect(withLogs[field]).toEqual(withoutLogs[field]));
    });
});

describe('buildMemberRetrospective', () => {
    it('counts club films and log films as two figures', () => {
        expect(jacob2026().count).toMatchObject({
            withClub: 7,
            onOwn: 4,
            minutes: { withClub: 97 + 6 * 120, onOwn: 100 + 120 + 91 + 109 },
        });
    });

    it('sets their club films beside each earlier year they saw any, log aside', () => {
        const { history, withClub } = jacob2026().count;
        expect(history[history.length - 1]).toEqual({ year: 2026, withClub });
        expect(history.slice(0, -1).every((h) => h.withClub > 0)).toBe(true);
        expect(buildMemberRetrospective(2025, 'Jacob', sources, NOW)!.count.history).toEqual(
            history.slice(0, -1)
        );
    });

    it('skips a year they saw nothing with the club', () => {
        const gap = film('tt2300002', 'Gap', '05/01/2023', 'Andy', four(5, 5, 5, 5));
        const history = buildMemberRetrospective(
            2026,
            'jacob',
            { ...sources, films: [...films, gap] },
            NOW
        )!.count.history;
        expect(history.map((h) => h.year)).toEqual([2023, 2025, 2026]);
    });

    it('starts their years with the club at the year they joined', () => {
        const joined = CLUB_JOINED.gabe;
        const before = film('tt2000001', 'Before', `05/01/${joined - 1}`, 'Andy', [
            makeRating({ user: 'gabe', score: 6 }),
        ]);
        const history = buildMemberRetrospective(
            2026,
            'gabe',
            { ...sources, films: [...films, before] },
            NOW
        )!.count.history;
        expect(history.map((h) => h.year)).not.toContain(joined - 1);
    });

    it('leaves scores added well after the screening out of their years with the club', () => {
        const withJacob = (watchDate: string, scoreAddedAt: string, imdbID: string) =>
            film(imdbID, imdbID, watchDate, 'Andy', [
                makeRating({ user: 'jacob', score: 6, scoreAddedAt }),
            ]);
        const history = (extra: Film[]) =>
            buildMemberRetrospective(
                2026,
                'jacob',
                { ...sources, films: [...films, ...extra] },
                NOW
            )!.count.history;
        const base = history([]);

        // Caught up on years later: no 2023 bar, and 2025 unchanged.
        expect(
            history([
                withJacob('03/01/2023', '2026-10-31T12:00:00Z', 'tt2300001'),
                withJacob('06/02/2025', '2026-10-31T12:00:00Z', 'tt2500003'),
            ])
        ).toEqual(base);
        // Scored on the site the next morning: still a night with the club.
        const nextDay = history([withJacob('06/02/2025', '2025-06-03T12:00:00Z', 'tt2500003')]);
        expect(nextDay.find((h) => h.year === 2025)!.withClub).toBe(
            base.find((h) => h.year === 2025)!.withClub + 1
        );
    });

    it('puts a log entry from 2026-01-01 in 2026, and one from the day before in 2025', () => {
        const ids = jacob2026().films.log.map((l) => l.imdbID);
        expect(ids[0]).toBe('tt9000001');
        expect(ids).not.toContain('tt9000000');
    });

    it('marks a logged club film as a club film without making it one', () => {
        const logged = jacob2026().films.log.find((l) => l.imdbID === fisher.imdbID)!;
        expect(logged.isClubFilm).toBe(true);
        expect(logged.title).toBe('The Fisher King');
        expect(jacob2026().films.club.filter((f) => f.imdbID === fisher.imdbID)).toHaveLength(1);
    });

    it('summarizes their club scores against the room', () => {
        const { scores } = jacob2026();
        expect(scores!.average).toBeCloseTo(40.5 / 7);
        expect(scores!.count).toBe(7);
        expect(scores!.highest).toMatchObject({ film: { imdbID: z.imdbID }, score: 8 });
        expect(scores!.lowest).toMatchObject({ film: { imdbID: odyssey.imdbID }, score: 3 });
        expect(
            Object.fromEntries(
                scores!.distribution.filter((d) => d.count).map((d) => [d.score, d.count])
            )
        ).toEqual({ 3: 1, 4: 1, 5: 2, 7: 2, 8: 1 });
        expect(scores!.logAverage).toBe(7);
        expect(scores!.logCount).toBe(3);
    });

    it('lists their picks without scoring them', () => {
        expect(jacob2026().picks!.map((f) => f.imdbID)).toEqual([irma.imdbID, nadja.imdbID]);
    });

    it('finds where they broke from the room', () => {
        const { breakaway } = jacob2026();
        expect(breakaway!.film.imdbID).toBe(odyssey.imdbID);
        expect(breakaway!.othersAverage).toBeCloseTo(6.45);
        expect(breakaway!.divergence).toBeCloseTo(-3.45);
    });

    it('reads their log: busiest month, week streak, and films nobody else saw', () => {
        const { log } = jacob2026();
        expect(log!.busiestMonth).toEqual({ months: [0], count: 3 });
        expect(log!.longestWeekStreak).toBe(3);
        expect(log!.first.imdbID).toBe('tt9000001');
        expect(log!.last.imdbID).toBe('tt9000004');
        // The Thing and Halloween; not the shared film, not the club film.
        expect(log!.solo).toBe(2);
    });

    it('does not count a film they watched with another member as theirs alone', () => {
        const withJoey = {
            ...sources,
            watched: {
                ...sources.watched,
                Jacob: jacobLog.map((e) =>
                    e.imdbID === 'tt9000002' ? { ...e, blurb: 'At the Heights with Joey.' } : e
                ),
            },
        };
        expect(buildMemberRetrospective(2026, 'jacob', withJoey, NOW)!.log!.solo).toBe(1);
    });

    it('reads taste across both sources, and countries from club films alone', () => {
        const { taste, director } = jacob2026();
        expect(taste!.genres[0]).toEqual({ name: 'Drama', count: 9 });
        expect(taste!.genres.find((g) => g.name === 'Horror')).toEqual({
            name: 'Horror',
            count: 2,
        });
        expect(taste!.countries.reduce((n, c) => n + c.count, 0)).toBe(7);
        expect(director).toMatchObject({ name: 'John Carpenter', withClub: 0, onOwn: 2 });
        expect(director!.imdbIDs).toHaveLength(2);
    });

    it('collects their words', () => {
        const { words } = jacob2026();
        expect(words!.count).toBe(3);
        expect(words!.longest.imdbID).toBe(nadja.imdbID);
        expect(words!.mostReacted!.imdbID).toBe('tt9000001');
        // Highest scores first; with only three reviews there's no separate lowest.
        expect(words!.highlights.map((r) => r.imdbID)).toEqual([
            'tt9000001',
            nadja.imdbID,
            odyssey.imdbID,
        ]);
    });

    it('collects trophies received and given in the year', () => {
        expect(jacob2026().trophies!.received).toEqual([]);
        expect(jacob2026().trophies!.given.map((t) => t.recipient)).toEqual(['Gabe']);
        const joey = buildMemberRetrospective(2026, 'Joey', sources, NOW)!;
        expect(joey.trophies!.received).toHaveLength(2);
    });

    it('lists the lists they made that year, by the reader’s calendar', () => {
        expect(jacob2026().lists!.map((l) => l.id)).toEqual(['jacob-2026']);
        expect(
            buildMemberRetrospective(2026, 'Gabe', sources, NOW)!.lists!.map((l) => l.id)
        ).toEqual(['gabe-nye']);
    });

    it('fills the closing card', () => {
        const { closing, scores } = jacob2026();
        expect(closing).toMatchObject({ films: 11, averageGiven: scores!.average, trophies: 0 });
        expect(closing.favourite).toMatchObject({ film: { imdbID: z.imdbID }, score: 8 });
    });

    it('gives a club-only member a shorter report, with every closing figure', () => {
        const andy = buildMemberRetrospective(2026, 'Andy', sources, NOW)!;
        expect(andy.count.onOwn).toBe(0);
        expect(andy.log).toBeNull();
        expect(andy.words).toBeNull();
        expect(andy.lists).toBeNull();
        expect(andy.trophies!.given.map((t) => t.recipient)).toEqual(['Joey']);
        expect(andy.closing.films).toBe(7);
        expect(andy.closing.averageGiven).not.toBeNull();
        expect(andy.closing.favourite!.film.imdbID).toBe(irma.imdbID);
    });

    it('gives guests no report of their own', () => {
        expect(buildMemberRetrospective(2026, 'Greg', sources, NOW)).toBeNull();
        expect(club2026().roster.map((m) => m.name)).not.toContain('Greg');
    });

    it('returns null for a member with nothing in the year, or no such member', () => {
        expect(buildMemberRetrospective(2026, 'Mark', sources, NOW)).toBeNull();
        expect(buildMemberRetrospective(2024, 'Jacob', sources, NOW)).toBeNull();
        expect(buildMemberRetrospective(2026, 'Nobody', sources, NOW)).toBeNull();
    });
});

describe('busiestMonth', () => {
    it('names every month tied for the most, earliest first', () => {
        expect(busiestMonth([2, 0, 2, 5, 0])).toEqual({ months: [0, 2], count: 2 });
    });

    it('names the one month when nothing ties it', () => {
        expect(busiestMonth([4, 4, 1])).toEqual({ months: [4], count: 2 });
    });

    it('has nothing to say about no dates', () => {
        expect(busiestMonth([])).toBeNull();
    });
});

describe('longestWeekStreak', () => {
    it('counts Monday-to-Sunday weeks in a row', () => {
        // Sun 4 Jan and Mon 5 Jan are different weeks; then a gap.
        expect(longestWeekStreak(['2026-01-04', '2026-01-05', '2026-01-12', '2026-02-02'])).toBe(3);
        expect(longestWeekStreak(['2026-01-05', '2026-01-06'])).toBe(1);
        expect(longestWeekStreak([])).toBe(0);
    });
});
