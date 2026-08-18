import {
    AWARD_LIMIT,
    NOTE_LIMIT,
    canEditTrophy,
    parseTrophyForm,
    sameTrophyForm,
    toTrophyForm,
} from './trophyEditUtils';
import { makeTrophy } from '../test-utils/factories';

describe('parseTrophyForm', () => {
    const form = { recipient: 'Joey', award: 'Bad Boy', note: '' };

    it('normalizes an empty note to null, matching what the worker stores', () => {
        expect(parseTrophyForm({ ...form, note: '   ' })).toEqual({
            input: { recipient: 'Joey', award: 'Bad Boy', note: null },
        });
    });

    it('trims every field', () => {
        expect(
            parseTrophyForm({ recipient: ' Joey ', award: ' Bad Boy ', note: ' for the podcast ' })
        ).toEqual({ input: { recipient: 'Joey', award: 'Bad Boy', note: 'for the podcast' } });
    });

    it('refuses a trophy with nobody to give it to', () => {
        expect(parseTrophyForm({ ...form, recipient: '' })).toEqual({
            error: 'Pick who the trophy goes to.',
        });
    });

    it('refuses a trophy with no name', () => {
        expect(parseTrophyForm({ ...form, award: '  ' })).toEqual({
            error: 'Give the trophy a name.',
        });
    });

    it('enforces the worker’s length caps before the request is made', () => {
        expect(parseTrophyForm({ ...form, award: 'x'.repeat(AWARD_LIMIT + 1) })).toEqual({
            error: `A trophy name is at most ${AWARD_LIMIT} characters.`,
        });
        expect(parseTrophyForm({ ...form, note: 'x'.repeat(NOTE_LIMIT + 1) })).toEqual({
            error: `A note is at most ${NOTE_LIMIT} characters.`,
        });
    });
});

describe('toTrophyForm', () => {
    it('shows a missing note as an empty field', () => {
        expect(toTrophyForm(makeTrophy({ note: null }))).toEqual({
            recipient: 'Andy',
            award: 'Togetherness Trophy',
            note: '',
        });
    });

    it('round-trips a stored award unchanged', () => {
        const trophy = makeTrophy({ note: 'for the group chat' });
        const parsed = parseTrophyForm(toTrophyForm(trophy));

        expect(parsed).toEqual({
            input: { recipient: trophy.recipient, award: trophy.award, note: trophy.note },
        });
    });
});

describe('sameTrophyForm', () => {
    it('compares field by field', () => {
        const form = { recipient: 'Andy', award: 'Helmet', note: '' };

        expect(sameTrophyForm(form, { ...form })).toBe(true);
        expect(sameTrophyForm(form, { ...form, note: 'x' })).toBe(false);
    });
});

describe('canEditTrophy', () => {
    const trophy = makeTrophy({ recipient: 'Andy', awardedBy: 'Jacob' });

    it('lets the member who gave it change it', () => {
        expect(canEditTrophy(trophy, 'Jacob', false)).toBe(true);
        expect(canEditTrophy(trophy, 'jacob', false)).toBe(true);
    });

    it('lets an admin change anyone’s', () => {
        expect(canEditTrophy(trophy, 'Gabe', true)).toBe(true);
    });

    // The rule that makes a trophy a joke rather than a nuisance: you cannot
    // quietly withdraw the Bad Boy award someone gave you.
    it('does not let the recipient withdraw their own', () => {
        expect(canEditTrophy(trophy, 'Andy', false)).toBe(false);
    });

    it('refuses when nobody is signed in', () => {
        expect(canEditTrophy(trophy, null, false)).toBe(false);
    });
});
