/**
 * Google Identity Services ID-token verification and member resolution.
 *
 * The browser signs in with GIS and sends the resulting JWT as a bearer token.
 * That flow needs only an OAuth *client ID* — no client secret — which is what
 * makes it usable from a static GitHub Pages origin. Because the credential is
 * a header rather than a cookie, CSRF isn't a factor here; CORS (in `index.ts`)
 * is the only other gate.
 *
 * Authorization is a six-name allowlist and nothing more: an email in
 * `MEMBER_EMAILS` may edit its own rows, an email in `ADMIN_EMAILS` may edit
 * anyone's, and an email in neither gets 403. For a fixed club that is the
 * right size of model.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { forbidden, unauthorized } from './errors';
import type { Env, Member } from './types';

/**
 * Google's signing keys. `createRemoteJWKSet` caches them in the isolate and
 * re-fetches only on an unknown `kid`, so most verifications cost no subrequest.
 */
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * The email → member-name map, parsed once per isolate.
 *
 * It is a worker secret rather than a repo file on purpose: this repository is
 * public and members' personal addresses should not be in it.
 */
let memberCache: { source: string; members: Map<string, string> } | null = null;

function memberMap(env: Env): Map<string, string> {
    if (memberCache?.source === env.MEMBER_EMAILS) return memberCache.members;

    let parsed: unknown;
    try {
        parsed = JSON.parse(env.MEMBER_EMAILS || '{}');
    } catch {
        throw new Error('MEMBER_EMAILS is not valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('MEMBER_EMAILS must be a JSON object of email → member name');
    }

    const members = new Map<string, string>();
    for (const [email, name] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof name === 'string' && name.trim()) {
            members.set(email.trim().toLowerCase(), name.trim());
        }
    }

    memberCache = { source: env.MEMBER_EMAILS, members };
    return members;
}

/** The club names the worker recognizes — the admin owner check in §8.3 needs them. */
export function memberNames(env: Env): string[] {
    return [...new Set(memberMap(env).values())];
}

/** Accepts either a JSON array or a plain comma-separated list, since both are easy to fat-finger into a secret. */
function adminEmails(env: Env): Set<string> {
    const raw = (env.ADMIN_EMAILS || '').trim();
    if (!raw) return new Set();

    let values: string[];
    if (raw.startsWith('[')) {
        const parsed: unknown = JSON.parse(raw);
        values = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } else {
        values = raw.split(',');
    }
    return new Set(values.map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function bearerToken(request: Request): string {
    const header = request.headers.get('Authorization') ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) throw unauthorized('Missing bearer token. Sign in with Google and try again.');
    return match[1].trim();
}

/**
 * Verifies the ID token and resolves it to a club member.
 *
 * `jwtVerify` checks the signature, `iss`, `aud`, and `exp`. `email_verified` is
 * the one claim worth asserting by hand — without it, a Google Workspace
 * account could in principle present an unverified address that happens to
 * match the allowlist.
 */
export async function authenticate(request: Request, env: Env): Promise<Member> {
    const token = bearerToken(request);

    let email: string;
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: GOOGLE_ISSUERS,
            audience: env.GOOGLE_CLIENT_ID,
        });
        if (payload.email_verified !== true) throw new Error('unverified email');
        if (typeof payload.email !== 'string') throw new Error('token carries no email');
        email = payload.email.toLowerCase();
    } catch (err) {
        // ID tokens last about an hour; an expired one is the common case here,
        // and the client's cue to re-prompt GIS rather than to show an error.
        const detail = err instanceof Error ? err.message : 'verification failed';
        throw unauthorized(`Sign-in could not be verified (${detail}).`);
    }

    const name = memberMap(env).get(email);
    if (!name) {
        // A member who changed Gmail addresses lands here. MEMBER_EMAILS is the
        // fix; say so rather than leaving them staring at a bare 403.
        throw forbidden(`${email} isn't on the club's list. Ask an admin to add it.`);
    }

    return { name, email, admin: adminEmails(env).has(email) };
}
