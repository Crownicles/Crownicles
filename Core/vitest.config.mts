import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			// Measure every source file, not only the ones a test happens to load
			include: ['src/**'],
			exclude: [
				'src/core/utils/Astronomy.ts',
				'src/core/CommandsTest.ts',
				'src/commands/admin/testCommands/**',
				'src/core/database/**/migrations/**'
			],
			reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
			reportsDirectory: './coverage',
			// Floors checked by `pnpm test:coverage` in CI: raise them when the coverage improves, never lower them
			thresholds: {
				lines: 26,
				branches: 24,
				functions: 34,
				statements: 26
			}
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