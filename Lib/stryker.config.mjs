import { readFileSync } from "node:fs";

/**
 * Index of the line declaring a function. "Class.method" looks for the method after the declaration of the class,
 * for names shared by several classes
 */
function declarationLine(lines, file, qualifiedName) {
	const [className, name] = qualifiedName.includes(".") ? qualifiedName.split(".") : [null, qualifiedName];
	const classLine = className === null ? 0 : lines.findIndex(line => new RegExp(`\\bclass ${className}\\b`, "u").test(line));
	const declaration = new RegExp(`^(\\s*)(export\\s+)?((public|private|protected|static|async|get|function)\\s+)*${name}\\s*(<[^>]*>)?\\(`, "u");
	const index = classLine === -1 ? -1 : lines.findIndex((line, lineIndex) => lineIndex >= classLine && declaration.test(line));
	if (index === -1) {
		throw new Error(`stryker.config.mjs: no function ${qualifiedName} in ${file}`);
	}
	return index;
}

/**
 * Index of the closing brace of the function declared at the given line, at the indentation of its declaration
 */
function endLine(lines, file, start) {
	const indent = /^\s*/u.exec(lines[start])[0];
	const index = lines.findIndex((line, lineIndex) => lineIndex > start && line === `${indent}}`);
	if (index === -1) {
		throw new Error(`stryker.config.mjs: no end for the function declared at line ${start + 1} of ${file}`);
	}
	return index;
}

/**
 * Lines of the logic of a file that mostly holds data: from the declaration of the first function to the closing
 * brace of the last one. Computed from the function names so that the range follows the code when lines move
 */
function range(file, firstFunction, lastFunction = firstFunction) {
	const lines = readFileSync(new URL(file, import.meta.url), "utf8").split("\n");
	const start = declarationLine(lines, file, firstFunction);
	const end = endLine(lines, file, declarationLine(lines, file, lastFunction));
	return `${file}:${start + 1}-${end + 1}`;
}

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
		range("src/constants/ClassInfoConstants.ts", "getClassLineageName", "getClassLineage"),
		range("src/constants/CookingConstants.ts", "hasUnlockedCookingSpecialties"),
		range("src/constants/CookingConstants.ts", "isRecipeEligibleForSlot"),
		range("src/constants/ExpeditionConstants.ts", "generateTerrainBasedRisk", "getRiskCategoryLevel"),
		range("src/constants/GardenConstants.ts", "getEffectiveGrowthTime", "getWateringAdvanceSeconds"),
		range("src/constants/GuildDomainConstants.ts", "computeTreasuryPenalty", "computeTreasuryGain"),
		range("src/constants/GuildDomainConstants.ts", "getShelterSlots", "getBuildingRequiredGuildLevel"),
		range("src/constants/ItemConstants.ts", "itemCategoryToString"),
		range("src/constants/ItemMaterialCategoryConstants.ts", "pickDistinctMaterials"),
		range("src/constants/KingChallengeConstants.ts", "roundThreshold", "sumRewards"),
		range("src/constants/PlantConstants.ts", "hasHomeStorageLink"),
		range("src/constants/PlantConstants.ts", "getHerbalistPrice", "lootRandomPlant"),
		range("src/constants/TokensConstants.ts", "buildRefillExpression"),
		"src/locks/**/*.ts",
		"src/packets/interaction/ReactionCollector*.ts",
		range("src/types/Effect.ts", "getById", "v4Id"),
		"src/types/FightActionResult.ts",
		range("src/types/HomeFeatures.ts", "getSlotCountForCategory"),
		range("src/types/HomeLevel.ts", "getNextUpgrade", "getNextLevelInfo"),
		range("src/types/ItemEnchantment.ts", "ItemEnchantment.constructor", "ItemEnchantment.getEnchantmentCost"),
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
