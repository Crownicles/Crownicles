import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['__tests__/**/*.{test,spec}.{js,ts}'],
		reporters: [
			'default',
			['junit', { outputFile: 'test-results.xml' }]
		]
	}
})
