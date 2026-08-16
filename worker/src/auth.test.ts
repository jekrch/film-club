/**
 * The half of the trust boundary that isn't in `validate.ts`.
 *
 * Token verification itself can't be tested here — it needs Google's JWKS, and
 * the `jose` stub these tests run against refuses to pretend otherwise. What
 * *is* testable is everything around it: how the two allowlist secrets are
 * parsed, and what happens when one of them is malformed. Both are pure
 * functions of `env`, and both decide who may write what.
 */

import { adminEmails, memberNames } from './auth';
import type { Env } from './types';

/** Only the two secrets under test matter; the rest of Env is never read here. */
function env(partial: Partial<Env>): Env {
    return partial as Env;
}

describe('memberNames', () => {
    it('maps emails to club names, deduplicated', () => {
        // Two addresses for one person is the ordinary case — a member who
        // changed Gmail accounts keeps both keys pointing at the same name.
        const names = memberNames(
            env({
                MEMBER_EMAILS: JSON.stringify({
                    'andy@example.com': 'Andy',
                    'andy.old@example.com': 'Andy',
                    'jacob@example.com': 'Jacob',
                }),
            })
        );
        expect(names).toEqual(['Andy', 'Jacob']);
    });

    it('drops entries with no usable name', () => {
        const names = memberNames(
            env({
                MEMBER_EMAILS: JSON.stringify({
                    'andy@example.com': 'Andy',
                    'blank@example.com': '   ',
                    'wrong@example.com': 42,
                }),
            })
        );
        expect(names).toEqual(['Andy']);
    });

    it('treats an unset secret as an empty club', () => {
        expect(memberNames(env({ MEMBER_EMAILS: '' }))).toEqual([]);
    });

    it('refuses to guess at a malformed secret', () => {
        // Unlike ADMIN_EMAILS below, this one throws: an unparseable member map
        // means nobody can be resolved at all, so there is no degraded mode to
        // fall back to and a 500 is the honest answer.
        expect(() => memberNames(env({ MEMBER_EMAILS: '{not json' }))).toThrow();
        expect(() => memberNames(env({ MEMBER_EMAILS: '["Andy"]' }))).toThrow();
    });
});

describe('adminEmails', () => {
    it('accepts a JSON array', () => {
        expect(adminEmails(env({ ADMIN_EMAILS: '["Jacob@Example.com"]' }))).toEqual(
            new Set(['jacob@example.com'])
        );
    });

    it('accepts a comma-separated list', () => {
        expect(adminEmails(env({ ADMIN_EMAILS: 'jacob@example.com, andy@example.com' }))).toEqual(
            new Set(['jacob@example.com', 'andy@example.com'])
        );
    });

    it('treats an unset secret as no admins', () => {
        expect(adminEmails(env({ ADMIN_EMAILS: '' })).size).toBe(0);
        expect(adminEmails(env({})).size).toBe(0);
    });

    it('fails closed on a malformed JSON secret instead of throwing', () => {
        // This runs on every request, outside authenticate's error handling, so
        // a throw here would 500 reads as well as writes. Losing admin rights
        // until the secret is fixed is the correct failure.
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        expect(adminEmails(env({ ADMIN_EMAILS: '["jacob@example.com"' })).size).toBe(0);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('fails closed when the JSON parses to the wrong shape', () => {
        expect(adminEmails(env({ ADMIN_EMAILS: '[{"email":"jacob@example.com"}]' })).size).toBe(0);
    });
});
