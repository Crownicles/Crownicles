import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			// Measure every source file, not only the ones a test happens to load
			include: ['src/**'],
			exclude: [
				'src/database/discord/migrations/**',
				'src/@types/**'
			],
			reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
			reportsDirectory: './coverage',
			// Floors checked by `pnpm test:coverage` in CI: raise them when the coverage improves, never lower them
			thresholds: {
				lines: 51,
				branches: 41,
				functions: 57,
				statements: 51
			}
		},
		environment: 'node',
		globals: true,
		include: ['**/*.{test,spec}.{js,ts}'],
		reporters: [
			'default',
			['junit', { outputFile: 'test-results.xml' }]
		]
	}
})