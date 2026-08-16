import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // All generated output. `dev-dist` (vite-plugin-pwa's Workbox bundle) and
    // `coverage` appear as soon as anyone runs `bun run dev` or `test:coverage`,
    // and linting that vendored output failed with rule-not-found errors — so
    // lint was red locally and green in CI, where a fresh checkout has neither.
    { ignores: ['dist', 'dev-dist', 'coverage', '**/node_modules'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            // Surface, but don't block on, remaining `any`s and stray console output.
            // These are warnings so CI (which fails on errors) stays green while the
            // debt stays visible. New code should avoid both.
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            // Allow intentionally-unused identifiers when prefixed with `_`.
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    // Test files lean on deliberately-malformed fixtures; keep the suppression
    // rules but don't let console noise from tests fail anything.
    {
        files: ['**/*.test.{ts,tsx}'],
        rules: {
            'no-console': 'off',
        },
    }
);
