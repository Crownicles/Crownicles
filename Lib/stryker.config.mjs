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
		"src/locks/**/*.ts",
		"src/types/TimeTypes.ts",
		"src/utils/**/*.ts"
	],
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
