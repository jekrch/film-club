/**
 * The trust boundary is the part of the worker worth testing hardest: it is
 * pure, and everything else in the worker assumes it ran. These run in the
 * site's own jest suite (`bun jest`) rather than a second runner, which is
 * possible precisely because `validate.ts` imports nothing but `errors.ts`.
 */

import { HttpError } from './errors';
import {
    LIMITS,
    assignListId,
    resolveOwner,
    slugify,
    validateImdbId,
    validateListInput,
    validateRatingPatch,
    validateWatchDate,
    validateWatchedPatch,
} from './validate';

/** Asserts the call is rejected, and with the status the router will return. */
function expectStatus(fn: () => unknown, status: number): void {
    try {
        fn();
    } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(status);
        return;
    }
    throw new Error('expected the call to throw');
}

describe('validateRatingPatch', () => {
    it('keeps only the fields the body carried', () => {
        expect(validateRatingPatch({ blurb: 'Softened on it.' })).toEqual({
            blurb: 'Softened on it.',
        });
    });

    it('distinguishes an absent field from an explicit null', () => {
        // Presence is the payload: absent means "the sheet's value stands",
        // null means "deliberately blank".
        expect(validateRatingPatch({ score: 7 })).not.toHaveProperty('blurb');
        expect(validateRatingPatch({ blurb: null })).toEqual({ blurb: null });
    });

    it('drops unknown fields rather than merging them', () => {
        expect(validateRatingPatch({ score: 7, user: 'andy', trophyInfo: 'nope' })).toEqual({
            score: 7,
        });
    });

    it('accepts one decimal place and rejects two', () => {
        expect(validateRatingPatch({ score: 8.1 })).toEqual({ score: 8.1 });
        expectStatus(() => validateRatingPatch({ score: 8.15 }), 400);
    });

    it('rejects scores outside 0–10 and non-numbers', () => {
        expectStatus(() => validateRatingPatch({ score: 11 }), 400);
        expectStatus(() => validateRatingPatch({ score: -1 }), 400);
        expectStatus(() => validateRatingPatch({ score: '7' }), 400);
        expectStatus(() => validateRatingPatch({ score: NaN }), 400);
    });

    it('normalizes a qualifier to one lowercase letter', () => {
        expect(validateRatingPatch({ scoreQualifier: 'D' })).toEqual({ scoreQualifier: 'd' });
        expect(validateRatingPatch({ scoreQualifier: '' })).toEqual({ scoreQualifier: null });
        expectStatus(() => validateRatingPatch({ scoreQualifier: 'doc' }), 400);
    });

    it('collapses a blank blurb to null and caps a long one', () => {
        expect(validateRatingPatch({ blurb: '   ' })).toEqual({ blurb: null });
        expectStatus(() => validateRatingPatch({ blurb: 'x'.repeat(LIMITS.blurb + 1) }), 400);
    });

    it('rejects a body with nothing recognizable in it', () => {
        // A silent 200 here would look like a successful save.
        expectStatus(() => validateRatingPatch({ nickname: 'andy' }), 400);
        expectStatus(() => validateRatingPatch([1, 2]), 400);
    });
});

describe('validateImdbId', () => {
    it('accepts 7 to 9 digit ids', () => {
        expect(validateImdbId('tt0107653')).toBe('tt0107653');
        expect(validateImdbId('tt123456789')).toBe('tt123456789');
    });

    it('rejects anything else', () => {
        expectStatus(() => validateImdbId('nm0000123'), 400);
        expectStatus(() => validateImdbId('tt12345'), 400);
        expectStatus(() => validateImdbId('../../../etc/passwd'), 400);
        expectStatus(() => validateImdbId(undefined), 400);
    });
});

describe('validateWatchDate', () => {
    it('accepts a real calendar date', () => {
        expect(validateWatchDate('2026-08-09')).toBe('2026-08-09');
        expect(validateWatchDate('  2026-08-09  ')).toBe('2026-08-09');
    });

    it('rejects a date that looks right but does not exist', () => {
        // `new Date('2026-02-31')` silently yields March 3rd, which would shift
        // the entry in the one field the log is ordered by.
        expectStatus(() => validateWatchDate('2026-02-31'), 400);
        expectStatus(() => validateWatchDate('2026-13-01'), 400);
    });

    it('rejects other formats and non-strings', () => {
        expectStatus(() => validateWatchDate('08/09/2026'), 400);
        expectStatus(() => validateWatchDate('2026-8-9'), 400);
        expectStatus(() => validateWatchDate(20260809), 400);
        expectStatus(() => validateWatchDate(null), 400);
    });

    it('rejects a date in the future but tolerates a caller a day ahead', () => {
        const day = 24 * 60 * 60 * 1000;
        const iso = (offset: number) => new Date(Date.now() + offset).toISOString().slice(0, 10);

        expect(validateWatchDate(iso(0))).toBe(iso(0));
        expect(validateWatchDate(iso(day))).toBe(iso(day));
        expectStatus(() => validateWatchDate(iso(3 * day)), 400);
    });
});

describe('validateWatchedPatch', () => {
    it('keeps only the fields the body carried', () => {
        expect(validateWatchedPatch({ blurb: 'Held up.' })).toEqual({ blurb: 'Held up.' });
        expect(validateWatchedPatch({ score: 8 })).not.toHaveProperty('watchDate');
    });

    it('drops unknown fields, including an imdbID the path already carries', () => {
        expect(
            validateWatchedPatch({ score: 8, imdbID: 'tt0000001', owner: 'Andy', updatedAt: 'x' })
        ).toEqual({ score: 8 });
    });

    it('applies the same score and qualifier rules as a club rating', () => {
        expect(validateWatchedPatch({ score: 8.1 })).toEqual({ score: 8.1 });
        expect(validateWatchedPatch({ scoreQualifier: 'D' })).toEqual({ scoreQualifier: 'd' });
        expectStatus(() => validateWatchedPatch({ score: 8.15 }), 400);
        expectStatus(() => validateWatchedPatch({ score: 11 }), 400);
        expectStatus(() => validateWatchedPatch({ scoreQualifier: 'doc' }), 400);
    });

    it('collapses a blank review to null and caps a long one', () => {
        expect(validateWatchedPatch({ blurb: '   ' })).toEqual({ blurb: null });
        expectStatus(() => validateWatchedPatch({ blurb: 'x'.repeat(LIMITS.blurb + 1) }), 400);
    });

    it('rejects a body with nothing it understands', () => {
        expectStatus(() => validateWatchedPatch({}), 400);
        expectStatus(() => validateWatchedPatch({ rewatch: true }), 400);
        expectStatus(() => validateWatchedPatch([]), 400);
    });
});

describe('validateListInput', () => {
    const base = { name: 'Top 5 Devastations', entries: [{ imdbID: 'tt0091251' }] };

    it('renumbers ranks positionally, ignoring what the client sent', () => {
        const list = validateListInput({
            ...base,
            entries: [
                { imdbID: 'tt0091251', rank: 40 },
                { imdbID: 'tt0107653', rank: 1 },
            ],
        });
        expect(list.entries.map((e) => [e.rank, e.imdbID])).toEqual([
            [1, 'tt0091251'],
            [2, 'tt0107653'],
        ]);
    });

    it('keeps the first of a duplicated film', () => {
        const list = validateListInput({
            ...base,
            entries: [
                { imdbID: 'tt0091251', description: 'first' },
                { imdbID: 'tt0091251', description: 'second' },
                { imdbID: 'tt0107653' },
            ],
        });
        expect(list.entries).toEqual([
            { rank: 1, imdbID: 'tt0091251', description: 'first' },
            { rank: 2, imdbID: 'tt0107653', description: null },
        ]);
    });

    it('drops unknown fields on the list and its entries', () => {
        const list = validateListInput({
            ...base,
            id: 'someone-elses-list',
            owner: 'Mark',
            entries: [{ imdbID: 'tt0091251', clubFilm: { title: 'injected' } }],
        });
        expect(list).toEqual({
            name: 'Top 5 Devastations',
            description: null,
            entries: [{ rank: 1, imdbID: 'tt0091251', description: null }],
        });
    });

    it('requires a name and allows an empty list', () => {
        expectStatus(() => validateListInput({ entries: [] }), 400);
        expectStatus(() => validateListInput({ name: '  ', entries: [] }), 400);
        expect(validateListInput({ name: 'Empty so far' }).entries).toEqual([]);
    });

    it('enforces the length caps', () => {
        expectStatus(() => validateListInput({ ...base, name: 'x'.repeat(LIMITS.listName + 1) }), 400);
        expectStatus(
            () => validateListInput({ ...base, description: 'x'.repeat(LIMITS.listDescription + 1) }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', description: 'x'.repeat(LIMITS.entryDescription + 1) }],
                }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: Array.from({ length: LIMITS.entries + 1 }, (_, i) => ({
                        imdbID: `tt${String(i).padStart(7, '0')}`,
                    })),
                }),
            400
        );
    });

    it('rejects a bad id inside an otherwise valid list', () => {
        expectStatus(() => validateListInput({ ...base, entries: [{ imdbID: 'tt1' }] }), 400);
    });
});

describe('resolveOwner', () => {
    const members = ['Andy', 'Jacob', 'Mark'];

    it('defaults to the caller', () => {
        expect(resolveOwner(undefined, { name: 'Jacob', admin: false }, members)).toBe('Jacob');
    });

    it('accepts the caller under any casing', () => {
        expect(resolveOwner('jacob', { name: 'Jacob', admin: false }, members)).toBe('Jacob');
    });

    it('forbids a non-admin writing for someone else', () => {
        // The check that matters most: without it, signing in as any member
        // lets you rewrite everyone's data.
        expectStatus(() => resolveOwner('Andy', { name: 'Jacob', admin: false }, members), 403);
    });

    it('lets an admin write for another member', () => {
        expect(resolveOwner('andy', { name: 'Jacob', admin: true }, members)).toBe('Andy');
    });

    it("won't let even an admin invent a member", () => {
        expectStatus(() => resolveOwner('Nobody', { name: 'Jacob', admin: true }, members), 400);
    });
});

describe('slugify / assignListId', () => {
    it('produces a URL-safe slug', () => {
        expect(slugify('Jacob-Top 5 Devastations!')).toBe('jacob-top-5-devastations');
        expect(slugify('Amélie & Co.')).toBe('amelie-co');
    });

    it('suffixes on collision', () => {
        expect(assignListId('Jacob', 'Comfort Watches', [])).toBe('jacob-comfort-watches');
        expect(assignListId('Jacob', 'Comfort Watches', ['jacob-comfort-watches'])).toBe(
            'jacob-comfort-watches-2'
        );
        expect(
            assignListId('Jacob', 'Comfort Watches', [
                'jacob-comfort-watches',
                'jacob-comfort-watches-2',
            ])
        ).toBe('jacob-comfort-watches-3');
    });

    it('falls back to a usable id when the name slugs to nothing', () => {
        expect(assignListId('!!', '???', [])).toBe('list');
    });
});
