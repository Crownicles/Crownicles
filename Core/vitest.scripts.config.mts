import { defineConfig } from 'vitest/config'

/*
 * Offline tools run with the game code and the mocks of the unit tests, never part of `pnpm test`:
 * `pnpm generateKingGuardLibrary` writes resources/kingGuards/library.json
 */
export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['scripts/**/*.script.ts'],
		testTimeout: 0
	}
})
