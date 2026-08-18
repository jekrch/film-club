/**
 * The trust boundary is the part of the worker worth testing hardest: it is
 * pure, and everything else in the worker assumes it ran. These run in the
 * site's own jest suite (`bun jest`) rather than a second runner, which is
 * possible precisely because `validate.ts` imports nothing but `errors.ts`.
 */

import { HttpError } from './errors';
import {
    LIMITS,
    assertMayEditTrophy,
    assignListId,
    assignTrophyId,
    base64ByteLength,
    resolveListOwner,
    resolveOwner,
    resolveRecipient,
    slugify,
    validateAvatarUpload,
    validateBackdropFilms,
    validateBackdropMode,
    validateImdbId,
    validateInterview,
    validateListInput,
    validateProfileImage,
    validateProfileLink,
    validateProfilePatch,
    validateClubWatchDate,
    validateFilmPatch,
    validateRatingPatch,
    resolveSelector,
    validateTrailerKey,
    validateTrophyInput,
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

    it('rejects scores outside the club\u2019s 0\u20139 scale, and non-numbers', () => {
        // 10 is not a score here: the club rates out of 9, and the site has
        // rendered every score as "/9" since long before it could write one.
        expectStatus(() => validateRatingPatch({ score: 10 }), 400);
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

describe('validateTrailerKey', () => {
    const KEY = 'dQw4w9WgXcQ';

    it('reduces every accepted link to the video id it carries', () => {
        expect(validateTrailerKey(`https://www.youtube.com/watch?v=${KEY}&t=9s`)).toBe(KEY);
        expect(validateTrailerKey(`https://youtu.be/${KEY}`)).toBe(KEY);
        expect(validateTrailerKey(`https://www.youtube.com/embed/${KEY}`)).toBe(KEY);
        expect(validateTrailerKey(`youtube.com/watch?v=${KEY}`)).toBe(KEY);
        expect(validateTrailerKey(KEY)).toBe(KEY);
    });

    it('reads blank and null alike as "use the film\'s own trailer"', () => {
        expect(validateTrailerKey(null)).toBeNull();
        expect(validateTrailerKey(undefined)).toBeNull();
        expect(validateTrailerKey('   ')).toBeNull();
    });

    it('refuses anything that would reach the embed as more than an id', () => {
        // The stored value is interpolated into an iframe src, so a link that
        // isn't a YouTube video — or an id that isn't one — is a 400 rather
        // than something stored verbatim.
        expectStatus(() => validateTrailerKey('https://evil.example/watch?v=' + KEY), 400);
        expectStatus(() => validateTrailerKey('https://www.youtube.com/results?q=trailer'), 400);
        expectStatus(() => validateTrailerKey(`${KEY}" onload="alert(1)`), 400);
        expectStatus(() => validateTrailerKey('javascript:alert(1)'), 400);
        expectStatus(() => validateTrailerKey(42), 400);
        expectStatus(() => validateTrailerKey('x'.repeat(LIMITS.trailerUrl + 1)), 400);
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

    it('carries a trailer link as a key, and the hide flag beside it', () => {
        expect(validateWatchedPatch({ trailerKey: 'https://youtu.be/dQw4w9WgXcQ' })).toEqual({
            trailerKey: 'dQw4w9WgXcQ',
        });
        expect(validateWatchedPatch({ trailerKey: null })).toEqual({ trailerKey: null });
        expect(validateWatchedPatch({ hideTrailer: true })).toEqual({ hideTrailer: true });
        expect(validateWatchedPatch({ hideTrailer: null })).toEqual({ hideTrailer: false });
        expectStatus(() => validateWatchedPatch({ hideTrailer: 'yes' }), 400);
        expectStatus(() => validateWatchedPatch({ trailerKey: 'https://vimeo.com/76979871' }), 400);
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

    it('carries an image link, and null to clear one', () => {
        expect(validateWatchedPatch({ image: 'https://img.example/still.jpg' })).toEqual({
            image: 'https://img.example/still.jpg',
        });
        expect(validateWatchedPatch({ image: null })).toEqual({ image: null });
        expectStatus(() => validateWatchedPatch({ image: 'http://img.example/still.jpg' }), 400);
    });

    it('carries a poster link independently of the background one', () => {
        // Two fields, one set of rules, and neither implies the other: a member
        // fixing a bad poster is not also asking for a new background.
        expect(validateWatchedPatch({ posterImage: 'https://img.example/poster.jpg' })).toEqual({
            posterImage: 'https://img.example/poster.jpg',
        });
        expect(validateWatchedPatch({ posterImage: null })).toEqual({ posterImage: null });
        expect(
            validateWatchedPatch({ image: 'https://img.example/still.jpg', posterImage: null })
        ).toEqual({ image: 'https://img.example/still.jpg', posterImage: null });
        expectStatus(() => validateWatchedPatch({ posterImage: 'http://img.example/p.jpg' }), 400);
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
            {
                rank: 1,
                imdbID: 'tt0091251',
                description: 'first',
                image: null,
                posterImage: null,
                trailerKey: null,
                hideTrailer: false,
                score: null,
            },
            {
                rank: 2,
                imdbID: 'tt0107653',
                description: null,
                image: null,
                posterImage: null,
                trailerKey: null,
                hideTrailer: false,
                score: null,
            },
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
            ranked: true,
            entries: [
                {
                    rank: 1,
                    imdbID: 'tt0091251',
                    description: null,
                    image: null,
                    posterImage: null,
                    trailerKey: null,
                    hideTrailer: false,
                    score: null,
                },
            ],
        });
    });

    it('stores a trailer link as a key, and the hide flag, per entry', () => {
        const { entries } = validateListInput({
            ...base,
            entries: [
                {
                    imdbID: 'tt0091251',
                    trailerKey: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    hideTrailer: true,
                },
            ],
        });
        expect(entries[0]).toMatchObject({ trailerKey: 'dQw4w9WgXcQ', hideTrailer: true });

        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', trailerKey: 'https://vimeo.com/76979871' }],
                }),
            400
        );
    });

    it('defaults to a ranked list and takes false when told', () => {
        // Absent is what a client too old to send the flag means, and what every
        // list written before it existed was.
        expect(validateListInput(base).ranked).toBe(true);
        expect(validateListInput({ ...base, ranked: null }).ranked).toBe(true);
        expect(validateListInput({ ...base, ranked: false }).ranked).toBe(false);
        expectStatus(() => validateListInput({ ...base, ranked: 'no' }), 400);
    });

    it('ranks an unranked list positionally all the same', () => {
        // Unranked drops the numerals on the site, not the order the member
        // arranged — which is `rank`, and is still stored.
        const list = validateListInput({
            ...base,
            ranked: false,
            entries: [{ imdbID: 'tt0091251' }, { imdbID: 'tt0107653' }],
        });
        expect(list.entries.map((e) => e.rank)).toEqual([1, 2]);
    });

    it('takes a per-entry score on the same 0–9 scale', () => {
        const list = validateListInput({
            ...base,
            entries: [
                { imdbID: 'tt0091251', score: 8.5 },
                { imdbID: 'tt0107653', score: null },
            ],
        });
        expect(list.entries.map((e) => e.score)).toEqual([8.5, null]);

        // Absent is the same as null: no score *here*, so the site falls back to
        // the member's log or club rating.
        expect(validateListInput(base).entries[0].score).toBeNull();

        expectStatus(
            () => validateListInput({ ...base, entries: [{ imdbID: 'tt0091251', score: 10 }] }),
            400
        );
        expectStatus(
            () => validateListInput({ ...base, entries: [{ imdbID: 'tt0091251', score: 8.15 }] }),
            400
        );
        expectStatus(
            () => validateListInput({ ...base, entries: [{ imdbID: 'tt0091251', score: '8' }] }),
            400
        );
    });

    it('takes an https background image per entry and rejects anything else', () => {
        const list = validateListInput({
            ...base,
            entries: [{ imdbID: 'tt0091251', image: '  https://img.example/still.jpg  ' }],
        });
        expect(list.entries[0].image).toBe('https://img.example/still.jpg');

        // Blank is the same as unset — a cleared field shouldn't store "".
        expect(
            validateListInput({ ...base, entries: [{ imdbID: 'tt0091251', image: '   ' }] })
                .entries[0].image
        ).toBeNull();

        // http would commit cleanly and then be blocked as mixed content.
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', image: 'http://img.example/x.jpg' }],
                }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', image: 'not a url' }],
                }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [
                        {
                            imdbID: 'tt0091251',
                            image: `https://img.example/${'x'.repeat(LIMITS.imageUrl)}.jpg`,
                        },
                    ],
                }),
            400
        );
    });

    it('takes an https poster per entry, separate from the background image', () => {
        const list = validateListInput({
            ...base,
            entries: [
                {
                    imdbID: 'tt0091251',
                    image: 'https://img.example/still.jpg',
                    posterImage: '  https://img.example/poster.jpg  ',
                },
            ],
        });
        expect(list.entries[0]).toMatchObject({
            image: 'https://img.example/still.jpg',
            posterImage: 'https://img.example/poster.jpg',
        });

        // Blank and absent both mean "use the film's own poster".
        expect(
            validateListInput({ ...base, entries: [{ imdbID: 'tt0091251', posterImage: '  ' }] })
                .entries[0].posterImage
        ).toBeNull();
        expect(validateListInput(base).entries[0].posterImage).toBeNull();

        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', posterImage: 'http://img.example/p.jpg' }],
                }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [{ imdbID: 'tt0091251', posterImage: 'not a url' }],
                }),
            400
        );
    });

    it('requires a name and allows an empty list', () => {
        expectStatus(() => validateListInput({ entries: [] }), 400);
        expectStatus(() => validateListInput({ name: '  ', entries: [] }), 400);
        expect(validateListInput({ name: 'Empty so far' }).entries).toEqual([]);
    });

    it('enforces the length caps', () => {
        expectStatus(
            () => validateListInput({ ...base, name: 'x'.repeat(LIMITS.listName + 1) }),
            400
        );
        expectStatus(
            () =>
                validateListInput({ ...base, description: 'x'.repeat(LIMITS.listDescription + 1) }),
            400
        );
        expectStatus(
            () =>
                validateListInput({
                    ...base,
                    entries: [
                        {
                            imdbID: 'tt0091251',
                            description: 'x'.repeat(LIMITS.entryDescription + 1),
                        },
                    ],
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

describe('validateProfileImage', () => {
    it('accepts an https URL', () => {
        expect(validateProfileImage('https://example.com/me.jpg')).toBe(
            'https://example.com/me.jpg'
        );
    });

    it("accepts the site's own image paths", () => {
        // Every member is stored this way today. Rejecting it would make the
        // first bio edit fail on a field the member never touched.
        expect(validateProfileImage('/images/andy.jpg')).toBe('/images/andy.jpg');
    });

    it('treats a protocol-relative URL as the other origin it is', () => {
        expectStatus(() => validateProfileImage('//evil.example/me.jpg'), 400);
    });

    it('refuses to store a traversal', () => {
        expectStatus(() => validateProfileImage('/images/../../secrets.json'), 400);
    });

    it('refuses http', () => {
        expectStatus(() => validateProfileImage('http://example.com/me.jpg'), 400);
    });

    it('reads blank as cleared', () => {
        expect(validateProfileImage('   ')).toBeNull();
        expect(validateProfileImage(null)).toBeNull();
    });
});

describe('validateProfileLink', () => {
    it('accepts an https URL', () => {
        expect(validateProfileLink('https://letterboxd.com/andy')).toBe(
            'https://letterboxd.com/andy'
        );
    });

    it('refuses a bare domain', () => {
        expectStatus(() => validateProfileLink('letterboxd.com/andy'), 400);
    });

    it('refuses a site path, which only an image may be', () => {
        expectStatus(() => validateProfileLink('/images/andy.jpg'), 400);
    });
});

describe('validateInterview', () => {
    it('trims and keeps the order it was given', () => {
        expect(
            validateInterview([
                { question: '  First film?  ', answer: '  Jaws.  ' },
                { question: 'Last?', answer: 'Sátántangó.' },
            ])
        ).toEqual([
            { question: 'First film?', answer: 'Jaws.' },
            { question: 'Last?', answer: 'Sátántangó.' },
        ]);
    });

    it('drops a row blank on both sides', () => {
        // The editor keeps an empty pair at the end; saving shouldn't require
        // the member to tidy it away first.
        expect(
            validateInterview([
                { question: 'First film?', answer: 'Jaws.' },
                { question: '', answer: '  ' },
            ])
        ).toHaveLength(1);
    });

    it('refuses a half-filled row rather than silently dropping the half', () => {
        expectStatus(() => validateInterview([{ question: 'First film?', answer: '' }]), 400);
        expectStatus(() => validateInterview([{ question: '', answer: 'Jaws.' }]), 400);
    });

    it('reads absent as no interview', () => {
        expect(validateInterview(undefined)).toEqual([]);
        expect(validateInterview(null)).toEqual([]);
    });

    it('caps the number of questions', () => {
        const many = Array.from({ length: LIMITS.interviewItems + 1 }, () => ({
            question: 'Q',
            answer: 'A',
        }));
        expectStatus(() => validateInterview(many), 400);
    });

    it('caps an answer', () => {
        expectStatus(
            () =>
                validateInterview([
                    { question: 'Q', answer: 'x'.repeat(LIMITS.interviewAnswer + 1) },
                ]),
            400
        );
    });
});

describe('validateProfilePatch', () => {
    it('keeps only the fields the body carried', () => {
        expect(validateProfilePatch({ bio: 'Watches too much.' })).toEqual({
            bio: 'Watches too much.',
        });
    });

    it('drops fields a member may not set', () => {
        // `name` is the key every rating, list, and log joins on; `queue` and
        // `color` are club-wide settings that merely live per member.
        expect(
            validateProfilePatch({
                bio: 'Watches too much.',
                name: 'Someone Else',
                queue: 1,
                color: 'rose-300',
            })
        ).toEqual({ bio: 'Watches too much.' });
    });

    it('normalizes a cleared title or bio to blank, not null', () => {
        // Both are required strings in club.json and render unconditionally.
        expect(validateProfilePatch({ title: '   ', bio: '' })).toEqual({ title: '', bio: '' });
    });

    it('normalizes a cleared link or image to null, which the handler removes', () => {
        expect(validateProfilePatch({ url: '', image: '' })).toEqual({ url: null, image: null });
    });

    it('rejects a body with nothing it recognizes', () => {
        // A silent 200 on an unrecognized body would look like a save.
        expectStatus(() => validateProfilePatch({ nickname: 'Ace' }), 400);
    });

    it('rejects a non-object body', () => {
        expectStatus(() => validateProfilePatch('bio'), 400);
        expectStatus(() => validateProfilePatch([{ bio: 'x' }]), 400);
    });

    it('caps the bio and the title', () => {
        expectStatus(() => validateProfilePatch({ bio: 'x'.repeat(LIMITS.bio + 1) }), 400);
        expectStatus(() => validateProfilePatch({ title: 'x'.repeat(LIMITS.title + 1) }), 400);
    });

    it('carries the banner choice through', () => {
        expect(
            validateProfilePatch({ backdropMode: 'selected', backdropFilms: ['tt0110912'] })
        ).toEqual({ backdropMode: 'selected', backdropFilms: ['tt0110912'] });
    });
});

describe('validateBackdropMode', () => {
    it('takes the two modes a banner has', () => {
        expect(validateBackdropMode('top-rated')).toBe('top-rated');
        expect(validateBackdropMode('selected')).toBe('selected');
    });

    it('reads absent and null as the default', () => {
        expect(validateBackdropMode(undefined)).toBe('top-rated');
        expect(validateBackdropMode(null)).toBe('top-rated');
    });

    it('rejects a mode nothing renders', () => {
        expectStatus(() => validateBackdropMode('random'), 400);
        expectStatus(() => validateBackdropMode(2), 400);
    });
});

describe('validateBackdropFilms', () => {
    it('keeps the order the member picked', () => {
        expect(validateBackdropFilms(['tt0110912', 'tt0068646'])).toEqual([
            'tt0110912',
            'tt0068646',
        ]);
    });

    it('collapses a double-added film rather than erroring', () => {
        // Two panels of the same film is a double tap, not a payload to refuse.
        expect(validateBackdropFilms(['tt0110912', 'tt0110912'])).toEqual(['tt0110912']);
    });

    it('reads absent and null as no selection', () => {
        expect(validateBackdropFilms(undefined)).toEqual([]);
        expect(validateBackdropFilms(null)).toEqual([]);
    });

    it('rejects anything that is not an IMDb id', () => {
        expectStatus(() => validateBackdropFilms(['pulp-fiction']), 400);
        expectStatus(() => validateBackdropFilms('tt0110912'), 400);
    });

    it('refuses more films than the banner has panels', () => {
        const tooMany = Array.from({ length: LIMITS.backdropFilms + 1 }, (_, i) => `tt000000${i}`);
        expectStatus(() => validateBackdropFilms(tooMany), 400);
    });
});

describe('validateAvatarUpload', () => {
    /** A base64 payload of a given byte length; the bytes themselves don't matter. */
    const payload = (bytes: number): string => btoa('x'.repeat(bytes));

    it('takes an image of a type this site can serve, and names the file for it', () => {
        expect(validateAvatarUpload({ contentType: 'image/png', data: payload(9) })).toEqual({
            contentType: 'image/png',
            extension: 'png',
            base64: payload(9),
            bytes: 9,
        });
    });

    it('rejects a type the site would not serve as an image', () => {
        // The extension comes from this map, so an unlisted type has no filename
        // to be given — which is the property that keeps a path out of the body.
        expectStatus(
            () => validateAvatarUpload({ contentType: 'image/svg+xml', data: 'AAAA' }),
            400
        );
        expectStatus(() => validateAvatarUpload({ contentType: 'text/html', data: 'AAAA' }), 400);
    });

    it('rejects a payload that is not base64', () => {
        // It would commit cleanly and then render as nothing at all.
        expectStatus(
            () => validateAvatarUpload({ contentType: 'image/jpeg', data: 'not!b64' }),
            400
        );
        expectStatus(() => validateAvatarUpload({ contentType: 'image/jpeg', data: 'AAA' }), 400);
        expectStatus(() => validateAvatarUpload({ contentType: 'image/jpeg', data: '' }), 400);
    });

    it('rejects a data URL, which carries its type twice', () => {
        expectStatus(
            () =>
                validateAvatarUpload({
                    contentType: 'image/jpeg',
                    data: 'data:image/jpeg;base64,AAAA',
                }),
            400
        );
    });

    it('caps what one upload may add to the repo forever', () => {
        expectStatus(
            () =>
                validateAvatarUpload({
                    contentType: 'image/jpeg',
                    data: payload(LIMITS.avatarBytes + 1),
                }),
            400
        );
    });

    it('measures the decoded bytes, not the base64 that carries them', () => {
        // Base64 costs a third; a cap applied to the string would be a cap on
        // three quarters of the image it stands for.
        const justUnder = payload(LIMITS.avatarBytes - 3);
        expect(justUnder.length).toBeGreaterThan(LIMITS.avatarBytes);
        expect(
            validateAvatarUpload({ contentType: 'image/jpeg', data: justUnder }).bytes
        ).toBeLessThanOrEqual(LIMITS.avatarBytes);
    });
});

describe('base64ByteLength', () => {
    it('agrees with what the browser encoded', () => {
        for (const text of ['a', 'ab', 'abc', 'abcd', 'a picture, roughly']) {
            expect(base64ByteLength(btoa(text))).toBe(text.length);
        }
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

describe('resolveListOwner', () => {
    const members = ['Andy', 'Jacob', 'Mark'];
    const admin = { name: 'Jacob', admin: true };
    const member = { name: 'Jacob', admin: false };

    it('leaves an existing list with its owner when the body names nobody', () => {
        // The regression this exists for: the list editor never sends `owner`,
        // and an admin may edit anyone's list. Falling back to the caller here
        // handed them Andy's list, entries intact and attribution gone.
        expect(resolveListOwner(undefined, admin, members, 'Andy')).toBe('Andy');
        expect(resolveListOwner(null, admin, members, 'Andy')).toBe('Andy');
        expect(resolveListOwner('', admin, members, 'Andy')).toBe('Andy');
    });

    it('gives a new list to the caller', () => {
        expect(resolveListOwner(undefined, member, members, null)).toBe('Jacob');
    });

    it('still lets an admin transfer a list by naming the owner outright', () => {
        expect(resolveListOwner('Mark', admin, members, 'Andy')).toBe('Mark');
    });

    it('leaves a member editing their own list alone', () => {
        expect(resolveListOwner(undefined, member, members, 'Jacob')).toBe('Jacob');
    });

    it('forbids a non-admin naming someone else, list or no list', () => {
        expectStatus(() => resolveListOwner('Andy', member, members, 'Jacob'), 403);
        expectStatus(() => resolveListOwner('Andy', member, members, null), 403);
    });

    it("won't let even an admin invent a member", () => {
        expectStatus(() => resolveListOwner('Nobody', admin, members, 'Andy'), 400);
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

describe('validateTrophyInput', () => {
    const members = ['Andy', 'Jacob', 'Mark'];

    it('accepts an award for another member', () => {
        // The whole point of the feature, and the one place on this API where
        // naming someone else is not a privilege escalation: a trophy is given,
        // not claimed.
        expect(
            validateTrophyInput(
                { recipient: 'andy', award: '  Togetherness Trophy  ', note: '' },
                members
            )
        ).toEqual({ recipient: 'Andy', award: 'Togetherness Trophy', note: null });
    });

    it('stores the recipient in club.json casing, whatever the client sent', () => {
        expect(validateTrophyInput({ recipient: 'MARK', award: 'Helmet' }, members).recipient).toBe(
            'Mark'
        );
    });

    it('keeps a note when there is one', () => {
        expect(
            validateTrophyInput(
                { recipient: 'Andy', award: 'Bad Boy', note: ' for the group chat ' },
                members
            ).note
        ).toBe('for the group chat');
    });

    it('refuses an award for someone who is not in the club', () => {
        expectStatus(() => validateTrophyInput({ recipient: 'Nobody', award: 'X' }, members), 400);
    });

    it('refuses an award with no recipient at all', () => {
        expectStatus(() => validateTrophyInput({ award: 'Helmet' }, members), 400);
        expectStatus(
            () => validateTrophyInput({ recipient: '   ', award: 'Helmet' }, members),
            400
        );
    });

    it('refuses an award with no name', () => {
        expectStatus(() => validateTrophyInput({ recipient: 'Andy' }, members), 400);
        expectStatus(() => validateTrophyInput({ recipient: 'Andy', award: '  ' }, members), 400);
    });

    it('enforces the length caps', () => {
        expectStatus(
            () =>
                validateTrophyInput(
                    { recipient: 'Andy', award: 'x'.repeat(LIMITS.award + 1) },
                    members
                ),
            400
        );
        expectStatus(
            () =>
                validateTrophyInput(
                    { recipient: 'Andy', award: 'Helmet', note: 'x'.repeat(LIMITS.trophyNote + 1) },
                    members
                ),
            400
        );
    });

    it('drops anything else the client sent', () => {
        const input = validateTrophyInput(
            { recipient: 'Andy', award: 'Helmet', awardedBy: 'Andy', id: 'forged' },
            members
        );

        // `awardedBy` decides who may later withdraw the award, so a client that
        // could set it could hand out trophies nobody is able to take back.
        expect(input).toEqual({ recipient: 'Andy', award: 'Helmet', note: null });
    });

    it('refuses a body that is not an object', () => {
        expectStatus(() => validateTrophyInput('Andy gets helmet', members), 400);
        expectStatus(() => validateTrophyInput([{ recipient: 'Andy' }], members), 400);
    });
});

describe('resolveRecipient', () => {
    const members = ['Andy', 'Jacob'];

    it('matches a member under any casing', () => {
        expect(resolveRecipient('  aNdY ', members)).toBe('Andy');
    });

    it('refuses a stranger', () => {
        expectStatus(() => resolveRecipient('Werner', members), 400);
    });

    it('refuses a non-string', () => {
        expectStatus(() => resolveRecipient(7, members), 400);
        expectStatus(() => resolveRecipient(null, members), 400);
    });
});

describe('assertMayEditTrophy', () => {
    const trophy = { awardedBy: 'Jacob', award: 'Bad Boy' };

    it('lets the member who gave it change it', () => {
        expect(() => assertMayEditTrophy(trophy, { name: 'jacob', admin: false })).not.toThrow();
    });

    it('lets an admin change anyone’s', () => {
        expect(() => assertMayEditTrophy(trophy, { name: 'Mark', admin: true })).not.toThrow();
    });

    it('forbids everyone else, the recipient included', () => {
        // A trophy the recipient could delete is not a trophy.
        expectStatus(() => assertMayEditTrophy(trophy, { name: 'Andy', admin: false }), 403);
    });

    it('names the giver in the refusal, so the caller knows who to ask', () => {
        try {
            assertMayEditTrophy(trophy, { name: 'Andy', admin: false });
        } catch (err) {
            expect((err as HttpError).message).toContain('Jacob');
            return;
        }
        throw new Error('expected the call to throw');
    });
});

describe('assignTrophyId', () => {
    it('slugs the recipient and the award together', () => {
        expect(assignTrophyId('Andy', 'Togetherness Trophy', [])).toBe('andy-togetherness-trophy');
    });

    it('suffixes on collision, so one member can win the same award twice', () => {
        expect(assignTrophyId('Andy', 'Helmet', ['andy-helmet'])).toBe('andy-helmet-2');
        expect(assignTrophyId('Andy', 'Helmet', ['andy-helmet', 'andy-helmet-2'])).toBe(
            'andy-helmet-3'
        );
    });

    it('falls back to a usable id when the award slugs to nothing', () => {
        expect(assignTrophyId('!!', '???', [])).toBe('trophy');
    });
});

describe('resolveSelector', () => {
    const members = ['Andy', 'Gabe', 'Jacob'];

    it('resolves a member to their canonical casing', () => {
        expect(resolveSelector('jacob', members)).toBe('Jacob');
        expect(resolveSelector('  GABE ', members)).toBe('Gabe');
    });

    it('treats blank and absent alike as "not recorded"', () => {
        expect(resolveSelector('', members)).toBeNull();
        expect(resolveSelector('   ', members)).toBeNull();
        expect(resolveSelector(null, members)).toBeNull();
        expect(resolveSelector(undefined, members)).toBeNull();
    });

    it('refuses a selector who is not in the club', () => {
        expectStatus(() => resolveSelector('Werner', members), 400);
    });

    it('lets any member name any other, since this is data and not a claim', () => {
        // Deliberately not `resolveOwner`: one person usually enters the whole
        // evening, including whose pick it was.
        expect(resolveSelector('Andy', members)).toBe('Andy');
    });
});

describe('validateClubWatchDate', () => {
    it('keeps the MM/DD/YYYY form films.json already stores', () => {
        expect(validateClubWatchDate('08/12/2020')).toBe('08/12/2020');
    });

    it('pads a single-digit month or day, so the column stays one shape', () => {
        expect(validateClubWatchDate('8/2/2020')).toBe('08/02/2020');
    });

    it('takes the two-digit years the column is half full of', () => {
        // `parseWatchDate` on the site applies the same 2000 pivot.
        expect(validateClubWatchDate('3/14/23')).toBe('03/14/2023');
        expect(validateClubWatchDate('12/20/23')).toBe('12/20/2023');
    });

    it('converts what a date input produces', () => {
        // The editor uses `<input type="date">`, which speaks ISO and nothing
        // else; `parseWatchDate` on the site reads MM/DD/YYYY and nothing else.
        expect(validateClubWatchDate('2026-02-03')).toBe('02/03/2026');
    });

    it('treats blank and null as a film the club has not watched yet', () => {
        expect(validateClubWatchDate(null)).toBeNull();
        expect(validateClubWatchDate('')).toBeNull();
        expect(validateClubWatchDate(undefined)).toBeNull();
    });

    it('rejects a date that does not exist', () => {
        // `new Date` would turn this into March 3rd without complaint.
        expectStatus(() => validateClubWatchDate('02/31/2026'), 400);
        expectStatus(() => validateClubWatchDate('2026-02-31'), 400);
    });

    it('rejects a year before the club existed', () => {
        // `parseWatchDate` drops anything before 2000 silently; refusing it here
        // is what turns that into something a member can read.
        expectStatus(() => validateClubWatchDate('08/12/1999'), 400);
    });

    it('rejects a date too far ahead to be a scheduled film', () => {
        const farOff = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        expectStatus(() => validateClubWatchDate(farOff), 400);
    });

    it('accepts a date next month, since the club schedules ahead', () => {
        const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        expect(validateClubWatchDate(soon)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('rejects text that is not a date at all', () => {
        expectStatus(() => validateClubWatchDate('August 2020'), 400);
        expectStatus(() => validateClubWatchDate(20200812), 400);
    });
});

describe('validateFilmPatch', () => {
    const members = ['Andy', 'Jacob'];

    it('keeps only the fields the body carried', () => {
        // Presence is the whole mechanism: a key that isn't here defers to the
        // sheet, and one that is — even as null — takes the field over.
        expect(validateFilmPatch({ selector: 'Jacob' }, members)).toEqual({ selector: 'Jacob' });
        expect(validateFilmPatch({ backdropImage: null }, members)).toEqual({
            backdropImage: null,
        });
    });

    it('accepts an empty patch, which is how a film is added with nothing known', () => {
        // Unlike a rating patch. The route refuses an empty body for a film the
        // club already has, where it really would mean a confused client.
        expect(validateFilmPatch({}, members)).toEqual({});
    });

    it('ignores fields a member may not set on a film', () => {
        expect(validateFilmPatch({ title: 'Renamed', imdbRating: '9.9' }, members)).toEqual({});
    });

    it('normalizes the watch date on the way in', () => {
        expect(validateFilmPatch({ watchDate: '2026-02-03' }, members)).toEqual({
            watchDate: '02/03/2026',
        });
    });

    it('requires both images to be https, since an http one renders as nothing', () => {
        expectStatus(() => validateFilmPatch({ poster: 'http://insecure.jpg' }, members), 400);
        expectStatus(() => validateFilmPatch({ backdropImage: 'not a url' }, members), 400);
    });

    it('names the field that failed, so the form can point at it', () => {
        try {
            validateFilmPatch({ backdropImage: 'http://insecure.jpg' }, members);
        } catch (err) {
            expect((err as HttpError).message).toContain('backdropImage');
            return;
        }
        throw new Error('expected the call to throw');
    });
});
