import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
    // The hooks rules are here because both apps poll on an interval inside an
    // effect, and a stale closure there shows a countdown that never moves —
    // a bug that looks like a server problem and is not.
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
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
