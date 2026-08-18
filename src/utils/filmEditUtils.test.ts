import {
    EMPTY_FILM_FORM,
    baselineFilmForm,
    buildFilmPatch,
    fromDateInput,
    parseFilmForm,
    sameFilmForm,
    toDateInput,
} from './filmEditUtils';
import type { FilmOverride } from '../api/clubApi';
import { makeClubInfo, makeFilm } from '../test-utils/factories';

const override = (fields: Partial<FilmOverride>): FilmOverride => ({
    updatedBy: 'Jacob',
    updatedAt: '2026-08-17T00:00:00Z',
    ...fields,
});

describe('toDateInput / fromDateInput', () => {
    it('converts the stored MM/DD/YYYY into what a date input accepts', () => {
        expect(toDateInput('08/12/2020')).toBe('2020-08-12');
        expect(toDateInput('8/2/2020')).toBe('2020-08-02');
    });

    it('passes an ISO date through, since the worker takes either', () => {
        expect(toDateInput('2020-08-12')).toBe('2020-08-12');
    });

    it('reads the two-digit years half the catalogue actually uses', () => {
        // 30 of the 73 films are stored this way — `3/14/23`, `1/2/24`,
        // `10/9/23` — and `parseWatchDate` has always accepted them.
        expect(toDateInput('3/14/23')).toBe('2023-03-14');
        expect(toDateInput('1/2/24')).toBe('2024-01-02');
        expect(toDateInput('10/9/23')).toBe('2023-10-09');
        expect(toDateInput('12/20/23')).toBe('2023-12-20');
    });

    it('blanks anything a date input would silently ignore', () => {
        // Passing it on would show an empty field that still counts as
        // unchanged, and the next save would blank a date nobody touched.
        expect(toDateInput('August 2020')).toBe('');
        expect(toDateInput(null)).toBe('');
        expect(toDateInput(undefined)).toBe('');
    });

    it('converts back to the form films.json stores', () => {
        expect(fromDateInput('2020-08-12')).toBe('08/12/2020');
    });
});

describe('baselineFilmForm', () => {
    const film = makeFilm({
        poster: 'https://omdb/poster.jpg',
        backdropImage: 'https://curated.jpg',
        movieClubInfo: makeClubInfo({ selector: 'Mark', watchDate: '08/12/2020' }),
    });

    it('falls back to the film for every field nobody has overridden', () => {
        expect(baselineFilmForm(film, undefined)).toEqual({
            selector: 'Mark',
            watchDate: '2020-08-12',
            poster: 'https://omdb/poster.jpg',
            backdropImage: 'https://curated.jpg',
        });
    });

    it('prefers an override where one exists, field by field', () => {
        expect(baselineFilmForm(film, override({ selector: 'Jacob' }))).toMatchObject({
            selector: 'Jacob',
            // Untouched by the override, so still the film's.
            watchDate: '2020-08-12',
        });
    });

    it('honours a deliberate blank rather than falling through to the film', () => {
        // Presence is what decides: `selector: null` means the member cleared
        // it, and showing the sheet's value would offer to put it back.
        expect(baselineFilmForm(film, override({ selector: null }))).toMatchObject({
            selector: '',
        });
    });

    it('renders an unknown film as an empty form', () => {
        expect(baselineFilmForm(undefined, undefined)).toEqual(EMPTY_FILM_FORM);
    });
});

describe('parseFilmForm', () => {
    it('normalizes every blank to null, matching what the worker stores', () => {
        expect(parseFilmForm(EMPTY_FILM_FORM)).toEqual({
            values: { selector: null, watchDate: null, poster: null, backdropImage: null },
        });
    });

    it('refuses a date the club could not have watched on', () => {
        expect(parseFilmForm({ ...EMPTY_FILM_FORM, watchDate: '1998-01-01' })).toEqual({
            error: 'The club has not been going that long — check the year.',
        });
    });

    it('names the field an image URL failed on', () => {
        expect(parseFilmForm({ ...EMPTY_FILM_FORM, poster: 'http://insecure.jpg' })).toEqual({
            error: expect.stringContaining('Cover image:'),
        });
        expect(parseFilmForm({ ...EMPTY_FILM_FORM, backdropImage: 'not a url' })).toEqual({
            error: expect.stringContaining('Background image:'),
        });
    });
});

describe('buildFilmPatch', () => {
    const baseline = {
        selector: 'Mark',
        watchDate: '2020-08-12',
        poster: 'https://omdb/poster.jpg',
        backdropImage: '',
    };

    const parse = (form: typeof baseline) => {
        const result = parseFilmForm(form);
        if ('error' in result) throw new Error(result.error);
        return result.values;
    };

    it('sends nothing when nothing moved', () => {
        expect(buildFilmPatch(parse(baseline), baseline)).toEqual({});
    });

    it('sends only the fields the member changed', () => {
        // The omission is the point: a patch carrying `selector` would make the
        // sheet's value inert on a field this member never looked at.
        expect(
            buildFilmPatch(parse({ ...baseline, backdropImage: 'https://hero.jpg' }), baseline)
        ).toEqual({ backdropImage: 'https://hero.jpg' });
    });

    it('converts a changed date back to the form films.json stores', () => {
        expect(buildFilmPatch(parse({ ...baseline, watchDate: '2026-02-03' }), baseline)).toEqual({
            watchDate: '02/03/2026',
        });
    });

    it('sends an explicit null for a field the member cleared', () => {
        expect(buildFilmPatch(parse({ ...baseline, poster: '' }), baseline)).toEqual({
            poster: null,
        });
    });
});

describe('a film whose date was entered with a two-digit year', () => {
    // The bug this pins down: the field rendered blank, and the next save on
    // that film would have sent `watchDate: null` and cleared a date nobody
    // had touched.
    const film = makeFilm({
        movieClubInfo: makeClubInfo({ selector: 'Andy', watchDate: '3/14/23' }),
    });

    it('shows the date rather than an empty field', () => {
        expect(baselineFilmForm(film, undefined).watchDate).toBe('2023-03-14');
    });

    it('sends no watch date when the member changed something else', () => {
        const baseline = baselineFilmForm(film, undefined);
        const parsed = parseFilmForm({ ...baseline, poster: 'https://alt/cover.jpg' });
        if ('error' in parsed) throw new Error(parsed.error);

        expect(buildFilmPatch(parsed.values, baseline)).toEqual({
            poster: 'https://alt/cover.jpg',
        });
    });

    it('normalizes to the long form when the member does change the date', () => {
        const baseline = baselineFilmForm(film, undefined);
        const parsed = parseFilmForm({ ...baseline, watchDate: '2023-03-15' });
        if ('error' in parsed) throw new Error(parsed.error);

        expect(buildFilmPatch(parsed.values, baseline)).toEqual({ watchDate: '03/15/2023' });
    });
});

describe('sameFilmForm', () => {
    it('compares field by field', () => {
        expect(sameFilmForm(EMPTY_FILM_FORM, { ...EMPTY_FILM_FORM })).toBe(true);
        expect(sameFilmForm(EMPTY_FILM_FORM, { ...EMPTY_FILM_FORM, selector: 'Andy' })).toBe(false);
    });
});
