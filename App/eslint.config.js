// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      'no-use-before-define': ['error', { variables: true }],
      'no-alert': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'prefer-template': 'error',
      'object-shorthand': ['error', 'always'],
      'no-void': 'error',
    },
  },
]);
