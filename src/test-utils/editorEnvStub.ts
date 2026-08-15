/**
 * Stands in for `src/config/editorEnv.ts` under jest (wired through
 * `moduleNameMapper`), which cannot parse the `import.meta.env` that module
 * reads.
 *
 * Both values are empty, so `isEditorConfigured()` is false and every editing
 * surface renders as it does on a build with no worker — which is what the
 * component tests assert against. A test that needs a configured editor should
 * mock `clubApi` rather than these.
 */
export const EDITOR_API_URL = '';
export const GOOGLE_CLIENT_ID = '';
