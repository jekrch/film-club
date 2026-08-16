/**
 * Stands in for `jose` so the worker's `auth.ts` can be imported by the suite.
 *
 * Same reason as the react-markdown stub next door: `jose` ships ESM only,
 * node_modules isn't transformed, and `auth.ts` calls `createRemoteJWKSet` at
 * module scope — so importing it for the sake of the *pure* helpers around it
 * (`memberNames`, `adminEmails`) was a parse error before this existed.
 *
 * `jwtVerify` throws rather than returning a plausible payload. Signature
 * checking is the one thing in this worker a stub must never appear to do: a
 * test that passed against a fake verification would be worse than no test.
 */

export function createRemoteJWKSet(_url: URL): () => never {
    return () => {
        throw new Error('jose is stubbed in tests; JWKS resolution is not available.');
    };
}

export function jwtVerify(): never {
    throw new Error('jose is stubbed in tests; token verification is not available.');
}
