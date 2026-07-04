import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.all,
  ...tseslint.configs.stylisticTypeChecked,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  sonarjs.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // --- Relax rules too strict for React functional components ---
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true, allowTypedFunctionExpressions: true }],
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/no-restricted-imports': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/no-invalid-this': 'off',
      '@typescript-eslint/max-params': 'off',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      '@typescript-eslint/parameter-properties': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/consistent-return': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      '@typescript-eslint/prefer-enum-initializers': 'off',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
      '@typescript-eslint/default-param-last': 'off',
      '@typescript-eslint/no-dupe-class-members': 'off',
      '@typescript-eslint/no-loop-func': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/dot-notation': 'off',

      // --- Keep strict correctness rules at 'error' ---
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/strict-void-return': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/method-signature-style': ['error', 'method'],
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
      '@typescript-eslint/no-unused-private-class-members': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',

      // --- SonarJS ---
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/prefer-while': 'warn',

      // --- React ---
      'react/no-unknown-property': ['error', { ignore: ['css'] }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'functions/', 'supabase/', '*.bak', 'k6.js', 'streak-flame-export.html'],
  },
);
