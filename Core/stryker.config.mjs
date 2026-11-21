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
		"src/core/report/ReportBlacksmithService.ts",
		"src/core/report/ReportCityBlacksmithService.ts",
		"src/core/report/ReportCityChestService.ts",
		"src/core/report/ReportCityEnchanterService.ts",
		"src/core/report/ReportCityFoodShopService.ts",
		"src/core/report/ReportCityGuildDomainService.ts",
		"src/core/report/ReportCityHomeService.ts",
		"src/core/report/ReportCityNotaryService.ts",
		"src/core/report/ReportCityRoyalBlacksmithService.ts",
		"src/core/report/ReportCityScrapDealerService.ts",
		"src/core/report/ReportCityService.ts",
		"src/core/report/ReportCityShopService.ts",
		"src/core/report/ReportRoyalBlacksmithService.ts"
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
