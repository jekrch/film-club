import type { TeamMember } from '../types/team';
import {
    ANSWER_LIMIT,
    BIO_LIMIT,
    TITLE_LIMIT,
    buildProfilePatch,
    newInterviewRow,
    parseProfileForm,
    sameProfileForm,
    toProfileForm,
    toProfileValues,
    type ProfileFormValues,
    type ProfileValues,
} from './profileEditUtils';

const member: TeamMember = {
    name: 'Jacob',
    title: 'Projectionist',
    bio: 'Watches too much.',
    image: '/images/jacob.jpg',
    url: 'https://letterboxd.com/jacob',
    queue: 2,
    color: 'blue-300',
    interview: [{ question: 'First film?', answer: 'Jaws.' }],
};

const form = (overrides: Partial<ProfileFormValues> = {}): ProfileFormValues => ({
    ...toProfileForm(toProfileValues(member)),
    ...overrides,
});

const values = (overrides: Partial<ProfileValues> = {}): ProfileValues => ({
    ...toProfileValues(member),
    ...overrides,
});

describe('toProfileValues', () => {
    it('keeps only what a member may edit', () => {
        expect(toProfileValues(member)).toEqual({
            title: 'Projectionist',
            bio: 'Watches too much.',
            url: 'https://letterboxd.com/jacob',
            image: '/images/jacob.jpg',
            interview: [{ question: 'First film?', answer: 'Jaws.' }],
        });
    });

    it('reads an absent link, image, or interview as unset', () => {
        expect(toProfileValues({ name: 'Andy', title: '', bio: '', image: '' })).toEqual({
            title: '',
            bio: '',
            url: null,
            image: null,
            interview: [],
        });
    });
});

describe('toProfileForm', () => {
    it('gives every interview row a key of its own', () => {
        const seeded = toProfileForm(
            values({
                interview: [
                    { question: 'A?', answer: 'Yes.' },
                    { question: 'B?', answer: 'No.' },
                ],
            })
        );
        const [first, second] = seeded.interview;
        expect(first.id).not.toEqual(second.id);
        expect(first.question).toBe('A?');
    });
});

describe('parseProfileForm', () => {
    it('trims what it stores', () => {
        const parsed = parseProfileForm(form({ title: '  Projectionist  ', bio: '  Hi.  ' }));
        expect(parsed).toEqual({
            values: expect.objectContaining({ title: 'Projectionist', bio: 'Hi.' }),
        });
    });

    it('keeps a site image path', () => {
        // Every member's picture is stored this way; the field has to accept
        // the value it was seeded with.
        const parsed = parseProfileForm(form({ image: '/images/jacob.jpg' }));
        expect(parsed).toEqual({ values: expect.objectContaining({ image: '/images/jacob.jpg' }) });
    });

    it('accepts an https picture from anywhere', () => {
        const parsed = parseProfileForm(form({ image: 'https://example.com/me.jpg' }));
        expect(parsed).toEqual({
            values: expect.objectContaining({ image: 'https://example.com/me.jpg' }),
        });
    });

    it('rejects a link that is only a site path', () => {
        // The exception is the picture's alone: a profile link points off-site.
        const parsed = parseProfileForm(form({ url: '/images/jacob.jpg' }));
        expect(parsed).toHaveProperty('error');
    });

    it('reads a cleared link or picture as unset', () => {
        const parsed = parseProfileForm(form({ url: '  ', image: '' }));
        expect(parsed).toEqual({ values: expect.objectContaining({ url: null, image: null }) });
    });

    it('drops an interview row left blank on both sides', () => {
        const parsed = parseProfileForm(
            form({ interview: [newInterviewRow('First film?', 'Jaws.'), newInterviewRow()] })
        );
        expect(parsed).toEqual({
            values: expect.objectContaining({
                interview: [{ question: 'First film?', answer: 'Jaws.' }],
            }),
        });
    });

    it('refuses a half-filled row rather than dropping the half', () => {
        expect(parseProfileForm(form({ interview: [newInterviewRow('First film?', '')] }))).toEqual({
            error: expect.stringContaining('First film?'),
        });
        expect(parseProfileForm(form({ interview: [newInterviewRow('', 'Jaws.')] }))).toHaveProperty(
            'error'
        );
    });

    it('catches an over-long field before the round trip', () => {
        expect(parseProfileForm(form({ title: 'x'.repeat(TITLE_LIMIT + 1) }))).toHaveProperty('error');
        expect(parseProfileForm(form({ bio: 'x'.repeat(BIO_LIMIT + 1) }))).toHaveProperty('error');
        expect(
            parseProfileForm(form({ interview: [newInterviewRow('Q', 'x'.repeat(ANSWER_LIMIT + 1))] }))
        ).toHaveProperty('error');
    });
});

describe('buildProfilePatch', () => {
    it('carries only what changed', () => {
        expect(buildProfilePatch(values({ bio: 'Watches more.' }), values())).toEqual({
            bio: 'Watches more.',
        });
    });

    it('is empty when nothing changed', () => {
        // The worker rejects a patch with no recognized field, so the editor has
        // to notice this itself rather than send it.
        expect(buildProfilePatch(values(), values())).toEqual({});
    });

    it('sends the whole interview when any part of it moved', () => {
        const reordered = values({
            interview: [
                { question: 'Second?', answer: 'Jaws 2.' },
                { question: 'First film?', answer: 'Jaws.' },
            ],
        });
        expect(buildProfilePatch(reordered, values()).interview).toHaveLength(2);
    });

    it('leaves the interview out when only its wording of another field changed', () => {
        expect(buildProfilePatch(values({ title: 'Usher' }), values())).toEqual({ title: 'Usher' });
    });

    it('sends null to clear a link', () => {
        // Distinct from "unchanged": the worker removes the key on null, and an
        // absent key would leave the old link in place.
        expect(buildProfilePatch(values({ url: null }), values())).toEqual({ url: null });
    });
});

describe('sameProfileForm', () => {
    it('ignores the row ids, which never leave the browser', () => {
        expect(sameProfileForm(form(), form())).toBe(true);
    });

    it('notices an edited answer', () => {
        expect(
            sameProfileForm(form({ interview: [newInterviewRow('First film?', 'Alien.')] }), form())
        ).toBe(false);
    });

    it('notices a removed row', () => {
        expect(sameProfileForm(form({ interview: [] }), form())).toBe(false);
    });
});
