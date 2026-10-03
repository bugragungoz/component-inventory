// Lint: names that are used but never declared (the bug that once broke add/edit), loose equality,
// and the browser's blocking dialogs, which the dialog plugin turns into async functions (B7, B8).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noBlockingDialogs = {
  'no-restricted-globals': ['error',
    { name: 'confirm', message: 'Use confirm() from src/state/dialogs (an in-app dialog that returns a Promise).' },
    { name: 'alert', message: 'Use a toast or an in-app dialog.' },
    { name: 'prompt', message: 'Use an in-app dialog with a text field.' }],
  'no-restricted-properties': ['error',
    { object: 'window', property: 'confirm', message: 'Use confirm() from src/state/dialogs.' },
    { object: 'window', property: 'alert', message: 'Use a toast or an in-app dialog.' },
    { object: 'window', property: 'prompt', message: 'Use an in-app dialog with a text field.' }],
};

export default tseslint.config(
  { ignores: ['dist/**', 'docs/design/bugra/**', 'extension/dist/**', 'src-tauri/**', 'target/**', 'node_modules/**', 'src/styles/tokens.css'] },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-undef': 'error', eqeqeq: ['error', 'smart'] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...noBlockingDialogs,
      eqeqeq: ['error', 'smart'],
      'no-control-regex': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
  { files: ['src/**/*.{js,mjs}', 'extension/src/**/*.{js,mjs}'], rules: noBlockingDialogs },
);
