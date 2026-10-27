import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'character/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx}'], rules: { 'no-undef': 'off' } },
  { files: ['**/*.mjs'], languageOptions: { globals: { URL: 'readonly', process: 'readonly', console: 'readonly' } } },
);
