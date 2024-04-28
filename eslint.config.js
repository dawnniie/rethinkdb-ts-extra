export default [
  {
    files: ['src/**.ts'],
    extends: [
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'standard'
    ],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
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
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        groups: ['index', 'sibling', 'parent', 'internal', 'external', 'builtin', 'object', 'type']
      }]
    },
    parserOptions: {
      project: ['./tsconfig.json']
    },
    ignores: [
      'dist/**',
      'node_modules/**'
    ]
  }
]
