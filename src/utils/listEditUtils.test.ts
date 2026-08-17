import {
    LIST_LIMITS,
    addFilmToDraft,
    buildListInput,
    draftEntryFromSearch,
    draftLabel,
    draftRowPoster,
    inheritedScoreFor,
    inheritedScoreHint,
    listExitPath,
    moveDraftEntry,
    patchDraftEntry,
    profilePath,
    removeDraftEntry,
    toDraftEntries,
    type DraftEntry,
} from './listEditUtils';
import type { ListDataSources } from './listUtils';
import type { FilmSearchResult } from '../api/clubApi';
import type { FilmListDefinition, FilmListEntry } from '../types/list';
import { makeClubInfo, makeFilm, makeRating } from '../test-utils/factories';

/**
 * Data sources are passed explicitly everywhere below rather than left to the
 * bundle, so the fallbacks under test are the fixtures' and not `films.json`'s.
 * An empty `films`/`summaries` is what an unresolved id looks like.
 */
const sources = (overrides: ListDataSources = {}): ListDataSources => ({
    films: [],
    summaries: {},
    watched: {},
    ...overrides,
});

const entry = (overrides: Partial<FilmListEntry> = {}): FilmListEntry => ({
    rank: 1,
    imdbID: 'tt0000001',
    description: null,
    score: null,
    ...overrides,
});

const list = (overrides: Partial<FilmListDefinition> = {}): FilmListDefinition => ({
    id: 'andys-horror',
    name: "Andy's Horror",
    owner: 'Andy',
    description: null,
    ranked: true,
    entries: [],
    ...overrides,
});

const draft = (overrides: Partial<DraftEntry> = {}): DraftEntry => ({
    imdbID: 'tt0000001',
    description: '',
    image: '',
    posterImage: '',
    trailer: '',
    hideTrailer: false,
    score: '',
    inheritedScore: null,
    inheritedFrom: null,
    title: 'Nosferatu',
    year: '1922',
    poster: null,
    ...overrides,
});

const hit = (overrides: Partial<FilmSearchResult> = {}): FilmSearchResult => ({
    imdbID: 'tt0000009',
    title: 'Vampyr',
    year: '1932',
    poster: 'https://img.example/vampyr.jpg',
    ...overrides,
});

describe('toDraftEntries', () => {
    it('reads the stored list in rank order, whatever order it was written in', () => {
        const drafted = toDraftEntries(
            list({
                entries: [
                    entry({ rank: 3, imdbID: 'tt3' }),
                    entry({ rank: 1, imdbID: 'tt1' }),
                    entry({ rank: 2, imdbID: 'tt2' }),
                ],
            }),
            sources()
        );

        expect(drafted.map((d) => d.imdbID)).toEqual(['tt1', 'tt2', 'tt3']);
    });

    it('turns every unset field into the empty form value it edits as', () => {
        // An entry written before the image/trailer fields existed carries none
        // of them, and has to open in the editor as a blank field rather than
        // the string "undefined".
        const [drafted] = toDraftEntries(list({ entries: [entry()] }), sources());

        expect(drafted).toMatchObject({
            description: '',
            image: '',
            posterImage: '',
            trailer: '',
            hideTrailer: false,
            score: '',
        });
    });

    it('renders a stored score as the text of the field, including zero', () => {
        const [zero] = toDraftEntries(list({ entries: [entry({ score: 0 })] }), sources());
        const [decimal] = toDraftEntries(list({ entries: [entry({ score: 7.5 })] }), sources());

        expect(zero.score).toBe('0');
        expect(decimal.score).toBe('7.5');
    });

    it("keeps the film's own poster behind the member's override", () => {
        // The row draws the override over `poster` and must fall back the moment
        // the field is cleared, which it could not do if the override had been
        // resolved into `poster` here.
        const film = makeFilm({ imdbID: 'tt0000001', poster: 'https://img.example/own.jpg' });
        const [drafted] = toDraftEntries(
            list({ entries: [entry({ posterImage: 'https://img.example/mine.jpg' })] }),
            sources({ films: [film] })
        );

        expect(drafted.poster).toBe('https://img.example/own.jpg');
        expect(drafted.posterImage).toBe('https://img.example/mine.jpg');
    });

    it('carries the title and year of a film the club watched', () => {
        const film = makeFilm({ imdbID: 'tt0000001', title: 'Nosferatu', year: '1922' });
        const [drafted] = toDraftEntries(list({ entries: [entry()] }), sources({ films: [film] }));

        expect(drafted).toMatchObject({ title: 'Nosferatu', year: '1922' });
    });

    it('leaves an unresolvable id title-less rather than failing the whole draft', () => {
        const drafted = toDraftEntries(
            list({ entries: [entry({ imdbID: 'tt9999999' })] }),
            sources()
        );

        expect(drafted).toHaveLength(1);
        expect(drafted[0]).toMatchObject({ imdbID: 'tt9999999', title: null, poster: null });
    });
});

describe('inheritedScoreFor', () => {
    const film = makeFilm({
        imdbID: 'tt0000001',
        movieClubInfo: makeClubInfo({ clubRatings: [makeRating({ user: 'andy', score: 6 })] }),
    });

    it("borrows the owner's watch-log score before their club rating", () => {
        expect(
            inheritedScoreFor(
                'tt0000001',
                'Andy',
                sources({
                    films: [film],
                    watched: {
                        Andy: [
                            {
                                imdbID: 'tt0000001',
                                watchDate: '2026-01-01',
                                score: 8,
                                scoreQualifier: null,
                                blurb: null,
                                updatedAt: '2026-01-01T00:00:00Z',
                            },
                        ],
                    },
                })
            )
        ).toEqual({ inheritedScore: 8, inheritedFrom: 'log' });
    });

    it('falls back to the club rating when they never logged it', () => {
        expect(inheritedScoreFor('tt0000001', 'Andy', sources({ films: [film] }))).toEqual({
            inheritedScore: 6,
            inheritedFrom: 'club',
        });
    });

    it("reports nothing when the owner hasn't scored the film anywhere", () => {
        expect(inheritedScoreFor('tt0000001', 'Andy', sources())).toEqual({
            inheritedScore: null,
            inheritedFrom: null,
        });
    });

    it('never reports `entry` as the source', () => {
        // It answers "what would this fall back to", so the entry's own score is
        // stripped before resolving — otherwise the hint under a filled field
        // would claim the field is inheriting from itself.
        const [drafted] = toDraftEntries(
            list({ entries: [entry({ score: 9 })] }),
            sources({ films: [film] })
        );

        expect(drafted.score).toBe('9');
        expect(drafted.inheritedFrom).toBe('club');
        expect(drafted.inheritedScore).toBe(6);
    });
});

describe('inheritedScoreHint', () => {
    it('says the empty field is showing the score already given', () => {
        expect(
            inheritedScoreHint(draft({ score: '', inheritedScore: 8, inheritedFrom: 'log' }))
        ).toBe('Showing 8 from your watch log.');
    });

    it('says a filled field overrides it', () => {
        expect(
            inheritedScoreHint(draft({ score: '9', inheritedScore: 8, inheritedFrom: 'log' }))
        ).toBe('Overrides 8 from your watch log.');
    });

    it('treats whitespace as an empty field', () => {
        expect(
            inheritedScoreHint(draft({ score: '   ', inheritedScore: 6, inheritedFrom: 'club' }))
        ).toBe('Showing 6 from your club rating.');
    });

    it('is silent when there is nothing to inherit', () => {
        expect(inheritedScoreHint(draft({ score: '7' }))).toBeNull();
    });
});

describe('draftLabel and draftRowPoster', () => {
    it('names a row by its title, and by its id when there is no title', () => {
        expect(draftLabel(draft({ title: 'Nosferatu' }))).toBe('Nosferatu');
        expect(draftLabel(draft({ title: null, imdbID: 'tt0000001' }))).toBe('tt0000001');
    });

    it("shows the member's poster while it is being typed", () => {
        expect(
            draftRowPoster(draft({ posterImage: ' https://img.example/mine.jpg ', poster: 'own' }))
        ).toBe('https://img.example/mine.jpg');
    });

    it("falls back to the film's own the moment the field is cleared", () => {
        expect(draftRowPoster(draft({ posterImage: '   ', poster: 'own' }))).toBe('own');
        expect(draftRowPoster(draft({ posterImage: '', poster: null }))).toBeNull();
    });
});

describe('addFilmToDraft', () => {
    it('appends the hit with its own metadata, so the row draws before CI catches up', () => {
        const result = addFilmToDraft([], hit(), 'Andy', sources());

        expect('entries' in result && result.entries).toEqual([
            draftEntryFromSearch(hit(), 'Andy', sources()),
        ]);
        expect('entries' in result && result.entries[0]).toMatchObject({
            imdbID: 'tt0000009',
            title: 'Vampyr',
            year: '1932',
            poster: 'https://img.example/vampyr.jpg',
            score: '',
        });
    });

    it('refuses a film already on the list, by name', () => {
        const result = addFilmToDraft([draft({ imdbID: 'tt0000009' })], hit(), 'Andy', sources());

        expect(result).toEqual({ notice: 'Vampyr is already on this list.' });
    });

    it('refuses to grow past the cap the worker enforces', () => {
        const full = Array.from({ length: LIST_LIMITS.entries }, (_, i) =>
            draft({ imdbID: `tt${i}` })
        );

        expect(addFilmToDraft(full, hit(), 'Andy', sources())).toEqual({
            notice: `A list holds at most ${LIST_LIMITS.entries} films.`,
        });
    });

    it('leaves the draft it was given untouched', () => {
        const entries = [draft({ imdbID: 'tt0000001' })];
        addFilmToDraft(entries, hit(), 'Andy', sources());

        expect(entries).toHaveLength(1);
    });

    it('marks a newly added film with the score its owner already gave it', () => {
        const film = makeFilm({
            imdbID: 'tt0000009',
            movieClubInfo: makeClubInfo({ clubRatings: [makeRating({ user: 'andy', score: 7 })] }),
        });
        const result = addFilmToDraft([], hit(), 'Andy', sources({ films: [film] }));

        expect('entries' in result && result.entries[0]).toMatchObject({
            inheritedScore: 7,
            inheritedFrom: 'club',
        });
    });
});

describe('moveDraftEntry', () => {
    const entries = [draft({ imdbID: 'a' }), draft({ imdbID: 'b' }), draft({ imdbID: 'c' })];

    it('swaps a row with its neighbour', () => {
        expect(moveDraftEntry(entries, 1, -1).map((e) => e.imdbID)).toEqual(['b', 'a', 'c']);
        expect(moveDraftEntry(entries, 1, 1).map((e) => e.imdbID)).toEqual(['a', 'c', 'b']);
    });

    it('returns the same array at either end, so a no-op never marks the draft dirty', () => {
        expect(moveDraftEntry(entries, 0, -1)).toBe(entries);
        expect(moveDraftEntry(entries, 2, 1)).toBe(entries);
    });

    it('ignores an index that is not a row', () => {
        expect(moveDraftEntry(entries, -1, 1)).toBe(entries);
        expect(moveDraftEntry(entries, 5, -1)).toBe(entries);
    });

    it('does not mutate the draft it was given', () => {
        moveDraftEntry(entries, 0, 1);

        expect(entries.map((e) => e.imdbID)).toEqual(['a', 'b', 'c']);
    });
});

describe('patchDraftEntry and removeDraftEntry', () => {
    const entries = [draft({ imdbID: 'a' }), draft({ imdbID: 'b' })];

    it('changes one row and leaves the rest identical', () => {
        const next = patchDraftEntry(entries, 'b', { description: 'Why this one.' });

        expect(next[0]).toBe(entries[0]);
        expect(next[1]).toMatchObject({ imdbID: 'b', description: 'Why this one.' });
        expect(entries[1].description).toBe('');
    });

    it('is a no-op for an id that is not on the list', () => {
        expect(patchDraftEntry(entries, 'zz', { description: 'x' })).toEqual(entries);
    });

    it('drops the row it names and only that row', () => {
        expect(removeDraftEntry(entries, 'a').map((e) => e.imdbID)).toEqual(['b']);
        expect(removeDraftEntry(entries, 'zz')).toHaveLength(2);
    });
});

describe('buildListInput', () => {
    const base = { name: 'Horror', description: '', ranked: true, entries: [] as DraftEntry[] };

    it('builds the payload the worker takes, trimming as it goes', () => {
        expect(
            buildListInput({
                ...base,
                name: '  Top 10 Horror  ',
                description: '  The ones that stuck.  ',
                ranked: false,
                entries: [
                    draft({
                        imdbID: 'tt1',
                        description: '  Still terrifying.  ',
                        image: 'https://img.example/bg.jpg',
                        posterImage: 'https://img.example/poster.jpg',
                        trailer: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        hideTrailer: false,
                        score: '8.5',
                    }),
                ],
            })
        ).toEqual({
            input: {
                name: 'Top 10 Horror',
                description: 'The ones that stuck.',
                ranked: false,
                entries: [
                    {
                        imdbID: 'tt1',
                        description: 'Still terrifying.',
                        image: 'https://img.example/bg.jpg',
                        posterImage: 'https://img.example/poster.jpg',
                        trailerKey: 'dQw4w9WgXcQ',
                        hideTrailer: false,
                        score: 8.5,
                    },
                ],
            },
        });
    });

    it('sends no rank: the order of the entries is the ranking, and the worker renumbers', () => {
        const built = buildListInput({
            ...base,
            entries: [draft({ imdbID: 'tt1' }), draft({ imdbID: 'tt2' })],
        });

        expect('input' in built && built.input.entries.map((e) => e.imdbID)).toEqual([
            'tt1',
            'tt2',
        ]);
        expect('input' in built && built.input.entries[0]).not.toHaveProperty('rank');
    });

    it('stores every empty optional field as an explicit null', () => {
        const built = buildListInput({ ...base, entries: [draft({ imdbID: 'tt1' })] });

        expect('input' in built && built.input).toMatchObject({
            description: null,
            entries: [
                {
                    description: null,
                    image: null,
                    posterImage: null,
                    trailerKey: null,
                    score: null,
                },
            ],
        });
    });

    it('requires a name that is more than whitespace', () => {
        expect(buildListInput({ ...base, name: '   ' })).toEqual({ error: 'A list needs a name.' });
    });

    it('names the row and the field in every message', () => {
        const bad = (overrides: Partial<DraftEntry>) =>
            buildListInput({ ...base, entries: [draft({ title: 'Nosferatu', ...overrides })] });

        expect(bad({ image: 'http://insecure.example/bg.jpg' })).toMatchObject({
            error: expect.stringContaining('Nosferatu, background image:'),
        });
        expect(bad({ posterImage: 'http://insecure.example/p.jpg' })).toMatchObject({
            error: expect.stringContaining('Nosferatu, poster:'),
        });
        expect(bad({ trailer: 'not a video' })).toMatchObject({
            error: expect.stringContaining('Nosferatu, trailer:'),
        });
        expect(bad({ score: '11' })).toMatchObject({
            error: expect.stringContaining('Nosferatu:'),
        });
    });

    it('falls back to the id when the row has no title to name', () => {
        expect(
            buildListInput({
                ...base,
                entries: [draft({ title: null, imdbID: 'tt7', score: '11' })],
            })
        ).toMatchObject({ error: expect.stringContaining('tt7:') });
    });

    it('reports the first bad row, in the order the member sees them', () => {
        const built = buildListInput({
            ...base,
            entries: [
                draft({ imdbID: 'tt1', title: 'First' }),
                draft({ imdbID: 'tt2', title: 'Second', score: '11' }),
                draft({ imdbID: 'tt3', title: 'Third', score: '12' }),
            ],
        });

        expect(built).toMatchObject({ error: expect.stringContaining('Second:') });
    });

    it('builds nothing at all when one row is wrong', () => {
        // The save is whole-list, so a partial payload would publish the good
        // rows and silently drop the bad one.
        expect(
            buildListInput({ ...base, entries: [draft({ score: 'eight' })] })
        ).not.toHaveProperty('input');
    });
});

describe('listExitPath and profilePath', () => {
    it('returns an edited list to its own page', () => {
        expect(listExitPath({ listId: 'andys-horror', owner: 'Andy', member: 'Andy' })).toBe(
            '/lists/andys-horror'
        );
    });

    it("sends an abandoned create to the owner's profile", () => {
        expect(listExitPath({ listId: undefined, owner: 'Andy', member: 'Jacob' })).toBe(
            '/profile/Andy'
        );
    });

    it('falls back to the signed-in member when the create never had an owner', () => {
        expect(listExitPath({ listId: undefined, owner: null, member: 'Jacob' })).toBe(
            '/profile/Jacob'
        );
    });

    it('has somewhere to go even with nobody signed in', () => {
        expect(listExitPath({ listId: undefined, owner: null, member: null })).toBe('/about');
        expect(profilePath(null)).toBe('/about');
        expect(profilePath(undefined)).toBe('/about');
    });

    it('escapes a name that would otherwise break the path', () => {
        expect(profilePath('Andy B/C')).toBe('/profile/Andy%20B%2FC');
    });
});
