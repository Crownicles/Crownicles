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
		"src/constants/ClassInfoConstants.ts:73-84",
		"src/constants/CookingConstants.ts:293-295",
		"src/constants/CookingConstants.ts:418-427",
		"src/constants/ExpeditionConstants.ts:766-803",
		"src/constants/GardenConstants.ts:57-67",
		"src/constants/GuildDomainConstants.ts:241-254",
		"src/constants/GuildDomainConstants.ts:300-342",
		"src/constants/ItemConstants.ts:20-32",
		"src/constants/ItemMaterialCategoryConstants.ts:45-63",
		"src/constants/KingChallengeConstants.ts:91-160",
		"src/constants/PlantConstants.ts:252-254",
		"src/constants/PlantConstants.ts:327-450",
		"src/constants/TokensConstants.ts:35-40",
		"src/locks/**/*.ts",
		"src/packets/interaction/ReactionCollector*.ts",
		"src/types/Effect.ts:39-71",
		"src/types/FightActionResult.ts",
		"src/types/HomeFeatures.ts:20-31",
		"src/types/HomeLevel.ts:144-180",
		"src/types/ItemEnchantment.ts:115-158",
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
