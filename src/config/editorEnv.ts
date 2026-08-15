/**
 * The two build-time settings the editing surfaces need, isolated in one module.
 *
 * `import.meta.env` is Vite syntax: ts-jest transpiles the suite to CommonJS,
 * where it is a parse error rather than an undefined value — so any module that
 * reads it directly takes every test importing it down with it. Keeping the
 * access here means jest can map this one file to a stub
 * (`src/test-utils/editorEnvStub.ts`) and everything downstream stays testable.
 *
 * Both are optional. Without them the site builds and runs exactly as it does
 * today, minus the editing surfaces — which is the right behavior for a fork or
 * a checkout that has no worker to talk to.
 */

/** Base URL of the editing worker, trailing slash trimmed. Empty when unset. */
export const EDITOR_API_URL = (import.meta.env.VITE_EDITOR_API_URL ?? '').replace(/\/+$/, '');

/**
 * The OAuth *web client* ID. Public by design in the ID-token flow — the
 * browser must send it, and the worker checks every token's `aud` against the
 * same value.
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
