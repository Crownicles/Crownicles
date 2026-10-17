import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			reportsDirectory: './coverage'
		},
		environment: 'node',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['**/*.{test,spec}.{js,ts}'],
		// Integration tests run via `pnpm test:integration` against a real
		// MariaDB and must not be picked up by the default unit-test run.
		exclude: ['node_modules/**', 'dist/**', '__tests__-integration/**'],
		reporters: [
			'default',
			['junit', { outputFile: 'test-results.xml' }]
		]
	}
})