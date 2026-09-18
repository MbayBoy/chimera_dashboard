import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lint configuration.
 *
 * Deliberately small. The rules that matter most in this codebase are enforced
 * by tests rather than by the linter — no market-specific literal, no locale key
 * missing from Arabic, no float in a money path — because those are the ones a
 * reviewer cannot reliably catch and a linter cannot express.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      'apps/buyer/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', fetch: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Front-end packages run in the browser.
    files: ['apps/terminal/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        Notification: 'readonly',
        AudioContext: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        caches: 'readonly',
        self: 'readonly',
      },
    },
  },
);
