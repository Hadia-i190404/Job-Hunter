// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Libraries we deliberately do not use. See CLAUDE.md, "Hard rules" and "Keep it lean".
const bannedImports = [
  {
    name: 'puppeteer',
    message: 'No browser automation libraries: logged-in sites are never automated (spec D3).',
  },
  {
    name: 'puppeteer-core',
    message: 'No browser automation libraries: logged-in sites are never automated (spec D3).',
  },
  {
    name: 'playwright',
    message: 'No browser automation libraries: logged-in sites are never automated (spec D3).',
  },
  {
    name: 'selenium-webdriver',
    message: 'No browser automation libraries: logged-in sites are never automated (spec D3).',
  },
  { name: 'axios', message: 'Use the built-in fetch.' },
  { name: 'node-fetch', message: 'Use the built-in fetch.' },
  { name: 'lodash', message: 'Use the standard library.' },
  { name: 'moment', message: 'Use Date / Intl.' },
  {
    name: '@anthropic-ai/sdk',
    message: 'No paid API calls: Claude runs through the plugin (spec D4).',
  },
  { name: 'openai', message: 'No paid API calls: Claude runs through the plugin (spec D4).' },
];

export default tseslint.config(
  { ignores: ['node_modules/', 'coverage/', 'dist/', 'tests/fixtures/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Keep functions and files small enough to review.
      complexity: ['error', 12],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],

      // Correctness and performance.
      eqeqeq: ['error', 'always'],
      'no-await-in-loop': 'error',
      'no-console': 'error',
      'prefer-const': 'error',
      'no-restricted-imports': ['error', { paths: bannedImports }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    // The plugin ships with zero runtime dependencies (spec D14): only node: built-ins
    // and relative imports, so installs and updates download nothing extra.
    files: ['plugin/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: bannedImports,
          patterns: [
            {
              regex: '^(?!node:|\\.)',
              message: 'The plugin has no dependencies: use node: built-ins or local files.',
            },
          ],
        },
      ],
    },
  },
  {
    // CLIs may print; tests may be long.
    files: ['tools/*.ts', 'plugin/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**/*.ts'],
    // it.each rows pass one argument per column.
    rules: { 'max-lines-per-function': 'off', 'max-params': 'off' },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
