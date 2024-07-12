module.exports = [
  {
    ...require('eslint-config-love'),
    files: ['src/**.ts'],
    ignores: ['dist/**', 'node_modules/**'],
    rules: {
      '@typescript-eslint/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'comma',
          requireLast: false
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }],
      '@typescript-eslint/method-signature-style': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: ['index', 'sibling', 'parent', 'internal', 'external', 'builtin', 'object', 'type']
      }]
    }
  }
]
