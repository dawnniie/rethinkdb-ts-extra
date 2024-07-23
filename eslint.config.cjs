module.exports = [
  {
    ...require('eslint-config-love'),
    files: ['src/**.ts'],
    ignores: ['dist/**', 'node_modules/**'],
    rules: {
      ...require('eslint-config-love').rules,
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/method-signature-style': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off'
    }
  }
]
