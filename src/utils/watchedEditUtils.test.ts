import {
    buildWatchedPatch,
    parseWatchedForm,
    toWatchedForm,
    toWatchedValues,
    todayLocal,
    type WatchedFormValues,
    type WatchedValues,
} from './watchedEditUtils';
import type { WatchedEntry } from '../types/watched';

const form = (overrides: Partial<WatchedFormValues> = {}): WatchedFormValues => ({
    watchDate: '2026-08-09',
    score: '',
    qualifier: '',
    blurb: '',
    image: '',
    posterImage: '',
    trailer: '',
    hideTrailer: false,
    ...overrides,
});

const values = (overrides: Partial<WatchedValues> = {}): WatchedValues => ({
    watchDate: '2026-08-09',
    score: null,
    scoreQualifier: null,
    blurb: null,
    image: null,
    posterImage: null,
    trailerKey: null,
    hideTrailer: false,
    ...overrides,
});

describe('parseWatchedForm', () => {
    it('normalizes a filled form to what the worker stores', () => {
        expect(
            parseWatchedForm(form({ score: '7.5', qualifier: 'D', blurb: '  Held up.  ' }))
        ).toEqual({
            values: {
                watchDate: '2026-08-09',
                score: 7.5,
                scoreQualifier: 'd',
                blurb: 'Held up.',
                image: null,
                posterImage: null,
                trailerKey: null,
                hideTrailer: false,
            },
        });
    });

    it('treats every blank field as a deliberate blank', () => {
        // No second writer to defer to, so empty is stored as null rather than
        // meaning "whatever the sheet said".
        expect(parseWatchedForm(form())).toEqual({ values: values() });
    });

    it('rejects a date that does not exist', () => {
        expect(parseWatchedForm(form({ watchDate: '2026-02-31' }))).toEqual({
            error: "2026-02-31 isn't a real date.",
        });
    });

    it('rejects a missing or malformed date', () => {
        expect(parseWatchedForm(form({ watchDate: '' }))).toHaveProperty('error');
        expect(parseWatchedForm(form({ watchDate: '08/09/2026' }))).toHaveProperty('error');
    });

    it('rejects a date in the future', () => {
        expect(parseWatchedForm(form({ watchDate: '2099-01-01' }))).toEqual({
            error: "You can't log a film you haven't watched yet.",
        });
        // Today is always fine, whatever timezone the viewer is in.
        expect(parseWatchedForm(form({ watchDate: todayLocal() }))).toHaveProperty('values');
    });

    it('says which of the two image fields a bad link is in', () => {
        expect(parseWatchedForm(form({ image: 'http://img.example/still.jpg' }))).toEqual({
            error: expect.stringContaining('Background image'),
        });
        expect(parseWatchedForm(form({ posterImage: 'img.example/poster.jpg' }))).toEqual({
            error: expect.stringContaining('Poster'),
        });
    });

    it('applies the club’s score rules', () => {
        expect(parseWatchedForm(form({ score: '8.15' }))).toHaveProperty('error');
        expect(parseWatchedForm(form({ score: '11' }))).toHaveProperty('error');
        expect(parseWatchedForm(form({ qualifier: 'doc' }))).toHaveProperty('error');
    });
});

describe('buildWatchedPatch', () => {
    it('carries only what changed', () => {
        expect(buildWatchedPatch(values({ score: 8 }), values())).toEqual({ score: 8 });
    });

    it('is empty when nothing changed, so a no-op never costs a commit', () => {
        expect(buildWatchedPatch(values({ blurb: 'Same.' }), values({ blurb: 'Same.' }))).toEqual(
            {}
        );
    });

    it('sends an explicit null for a field the member cleared', () => {
        expect(buildWatchedPatch(values(), values({ score: 8, blurb: 'Gone.' }))).toEqual({
            score: null,
            blurb: null,
        });
    });

    it('treats the two image fields as separate edits', () => {
        expect(
            buildWatchedPatch(
                values({ posterImage: 'https://img.example/poster.jpg' }),
                values({ image: 'https://img.example/still.jpg' })
            )
        ).toEqual({ image: null, posterImage: 'https://img.example/poster.jpg' });

        // Setting a poster leaves a background the member never touched alone,
        // so the patch — and the diff it commits — stays one field wide.
        const withStill = values({ image: 'https://img.example/still.jpg' });
        expect(
            buildWatchedPatch({ ...withStill, posterImage: 'https://img.example/p.jpg' }, withStill)
        ).toEqual({ posterImage: 'https://img.example/p.jpg' });
    });

    it('sends a moved date on a rewatch', () => {
        expect(
            buildWatchedPatch(
                values({ watchDate: '2026-08-10' }),
                values({ watchDate: '2026-01-02' })
            )
        ).toEqual({ watchDate: '2026-08-10' });
    });
});

describe('toWatchedValues / toWatchedForm', () => {
    it('round-trips an entry through the form, dropping provenance', () => {
        const entry: WatchedEntry = {
            imdbID: 'tt0078748',
            watchDate: '2026-08-09',
            score: 8,
            scoreQualifier: null,
            blurb: 'Corridors.',
            updatedAt: '2026-08-09T21:14:02Z',
        };

        const stored = toWatchedValues(entry);
        expect(stored).not.toHaveProperty('updatedAt');
        expect(stored).not.toHaveProperty('imdbID');

        const parsed = parseWatchedForm(toWatchedForm(stored));
        expect(parsed).toEqual({ values: stored });
    });
});
