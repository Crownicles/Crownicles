// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['app.config.js', 'plugins/**/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly' },
    },
  },
  {
    ignores: ['dist/*'],
    rules: {
      'no-use-before-define': ['error', { variables: true }],
      'no-alert': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'prefer-template': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],
      'no-void': 'error',
    },
  },
  // Screen formats are decided in docs/adr/0001-formats-ecran.html: windows are opened by the design primitives only.
  {
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['src/design/**', 'src/components/MapViewer.tsx', 'src/components/WorldMap.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'react-native',
            importNames: ['Modal', 'Alert'],
            message: 'Use a screen format primitive (BottomSheet, QuestionSheet, FullScreen, Page, Toast, CelebrationModal): see App/docs/adr/0001-formats-ecran.html.',
          },
          {
            name: '@/src/design/Sections',
            importNames: ['SheetModal', 'ModalSurface'],
            message: 'These build the primitives; use FullScreen or BottomSheet instead: see App/docs/adr/0001-formats-ecran.html.',
          },
        ],
      }],
    },
  },
  // iOS loses a window opened while another one moves or while the app wakes up: every native window waits its turn in NativeWindow.
  {
    files: ['src/design/**/*.{ts,tsx}'],
    ignores: ['src/design/NativeWindow.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'react-native',
            importNames: ['Modal'],
            message: 'Open native windows through NativeWindow, which waits for the app to be active and for the other windows to settle.',
          },
        ],
      }],
    },
  },
]);
