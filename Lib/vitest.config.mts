import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			// Measure every source file, not only the ones a test happens to load
			include: ['src/**'],
			exclude: [
				'src/keycloak/**',
				'src/packets/{announcements,commands,events,fights,notifications}/**'
			],
			reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
			reportsDirectory: './coverage',
			// Floors checked by `pnpm test:coverage` in CI: raise them when the coverage improves, never lower them
			thresholds: {
				lines: 30,
				branches: 26,
				functions: 26,
				statements: 29
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