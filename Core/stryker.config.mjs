/**
 * Mutation testing (#5165): checks that the unit tests fail when the code under test changes.
 * Only the files listed in `mutate` are mutated. Add a file once its tests are written.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	testRunner: "vitest",
	// pnpm does not hoist the runner where Stryker looks for plugins by default
	plugins: ["@stryker-mutator/vitest-runner"],
	vitest: {
		configFile: "vitest.config.mts"
	},
	mutate: [
		"src/core/missions/MissionsController.ts",
		"src/core/smallEvents/altar.ts",
		"src/core/smallEvents/badPet.ts",
		"src/core/smallEvents/dwarfPetFan.ts",
		"src/core/smallEvents/expeditionAdvice.ts",
		"src/core/smallEvents/fightPet.ts",
		"src/core/smallEvents/gardener.ts",
		"src/core/smallEvents/gobletsGame.ts",
		"src/core/smallEvents/interactOtherPlayers.ts",
		"src/core/smallEvents/limoges.ts",
		"src/core/smallEvents/lottery.ts",
		"src/core/smallEvents/petFood.ts",
		"src/core/smallEvents/ultimateFoodMerchant.ts",
		"src/core/smallEvents/witch.ts"
	],
	// Imports reach ../Lib through relative paths that a copied sandbox would break: mutate the files in place (restored at the end)
	inPlace: true,
	coverageAnalysis: "perTest",
	incremental: true,
	incrementalFile: "reports/stryker-incremental.json",
	reporters: ["clear-text", "progress", "html", "json"],
	htmlReporter: {
		fileName: "reports/mutation/mutation.html"
	},
	jsonReporter: {
		fileName: "reports/mutation/mutation.json"
	},
	thresholds: {
		high: 80,
		low: 60,
		break: null
	}
};
