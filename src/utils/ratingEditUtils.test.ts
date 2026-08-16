import {
    baselineRating,
    buildRatingPatch,
    parseRatingForm,
    toFormValues,
    type RatingFormValues,
} from './ratingEditUtils';
import type { RatingOverride } from '../api/clubApi';
import type { ClubRating } from '../types/film';

const sheetRating = (rating: Partial<ClubRating> = {}): ClubRating => ({
    user: 'andy',
    score: 7,
    blurb: 'From the sheet.',
    ...rating,
});

const override = (fields: Partial<RatingOverride>): RatingOverride => ({
    updatedBy: 'Andy',
    updatedAt: '2026-08-12T19:04:11Z',
    ...fields,
});

const form = (values: Partial<RatingFormValues> = {}): RatingFormValues => ({
    score: '',
    qualifier: '',
    blurb: '',
    ...values,
});

describe('baselineRating', () => {
    it('uses the sheet-derived rating when there is no override', () => {
        expect(baselineRating(undefined, sheetRating({ scoreQualifier: 'd' }))).toEqual({
            score: 7,
            scoreQualifier: 'd',
            blurb: 'From the sheet.',
        });
    });

    it('is all-null for a film the member never rated', () => {
        expect(baselineRating(undefined, undefined)).toEqual({
            score: null,
            scoreQualifier: null,
            blurb: null,
        });
    });

    // Presence, not truthiness: this is the distinction the whole override
    // scheme rests on (§8.7).
    it('leaves the sheet in charge of fields the override does not mention', () => {
        expect(baselineRating(override({ score: 9 }), sheetRating())).toEqual({
            score: 9,
            scoreQualifier: null,
            blurb: 'From the sheet.',
        });
    });

    it('treats an explicit null in the override as a deliberate blank', () => {
        expect(baselineRating(override({ blurb: null }), sheetRating())).toEqual({
            score: 7,
            scoreQualifier: null,
            blurb: null,
        });
    });
});

describe('parseRatingForm', () => {
    it('normalizes empty fields to null rather than empty strings', () => {
        expect(parseRatingForm(form())).toEqual({
            values: { score: null, scoreQualifier: null, blurb: null },
        });
    });

    it('accepts one decimal place and lowercases the qualifier', () => {
        expect(parseRatingForm(form({ score: '8.1', qualifier: ' D ' }))).toEqual({
            values: { score: 8.1, scoreQualifier: 'd', blurb: null },
        });
    });

    it('trims a blurb', () => {
        const parsed = parseRatingForm(form({ blurb: '  Loved it.  ' }));
        expect(parsed).toEqual({
            values: { score: null, scoreQualifier: null, blurb: 'Loved it.' },
        });
    });

    it.each([
        ['not a number', form({ score: 'eight' }), /must be a number/],
        ['a score above the club\u2019s scale', form({ score: '10' }), /between 0 and 9/],
        ['a negative score', form({ score: '-1' }), /between 0 and 9/],
        ['too precise', form({ score: '8.15' }), /one decimal place/],
        ['a multi-letter qualifier', form({ qualifier: 'doc' }), /single letter/],
        ['an over-long review', form({ blurb: 'x'.repeat(4001) }), /limit is 4000/],
    ])('rejects %s', (_case, values, message) => {
        const parsed = parseRatingForm(values);
        expect('error' in parsed && parsed.error).toEqual(expect.stringMatching(message));
    });
});

describe('buildRatingPatch', () => {
    const baseline = { score: 7, scoreQualifier: null, blurb: 'From the sheet.' };

    it('is empty when nothing changed, so an untouched save is refused', () => {
        expect(buildRatingPatch({ ...baseline }, baseline)).toEqual({});
    });

    // The point of the whole exercise: an untouched field must stay out of the
    // patch, or saving a score would freeze the sheet's blurb as an override.
    it('carries only the fields that changed', () => {
        expect(buildRatingPatch({ ...baseline, score: 9 }, baseline)).toEqual({ score: 9 });
    });

    it('sends an explicit null for a field the member cleared', () => {
        expect(buildRatingPatch({ ...baseline, blurb: null }, baseline)).toEqual({ blurb: null });
    });

    it('sends every field when the member had nothing before', () => {
        expect(
            buildRatingPatch(
                { score: 6, scoreQualifier: 'd', blurb: 'A doc.' },
                { score: null, scoreQualifier: null, blurb: null }
            )
        ).toEqual({ score: 6, scoreQualifier: 'd', blurb: 'A doc.' });
    });
});

describe('toFormValues', () => {
    it('renders nulls as empty inputs and round-trips through the parser', () => {
        const values = { score: 8.5, scoreQualifier: null, blurb: null };
        expect(toFormValues(values)).toEqual({ score: '8.5', qualifier: '', blurb: '' });
        expect(parseRatingForm(toFormValues(values))).toEqual({ values });
    });
});
