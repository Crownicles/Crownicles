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
		"src/core/fights/FightController.ts",
		"src/core/fights/actions/FightActionController.ts",
		"src/core/fights/actions/interfaces/alterations/bleeding.ts",
		"src/core/fights/actions/interfaces/alterations/burned.ts",
		"src/core/fights/actions/interfaces/alterations/concentrated.ts",
		"src/core/fights/actions/interfaces/alterations/confused.ts",
		"src/core/fights/actions/interfaces/alterations/cursed.ts",
		"src/core/fights/actions/interfaces/alterations/frozen.ts",
		"src/core/fights/actions/interfaces/alterations/full.ts",
		"src/core/fights/actions/interfaces/alterations/outOfBreath.ts",
		"src/core/fights/actions/interfaces/alterations/paralyzed.ts",
		"src/core/fights/actions/interfaces/alterations/poisoned.ts",
		"src/core/fights/actions/interfaces/alterations/protected.ts",
		"src/core/fights/actions/interfaces/alterations/slowed.ts",
		"src/core/fights/actions/interfaces/alterations/stunned.ts",
		"src/core/fights/actions/interfaces/alterations/targeted.ts",
		"src/core/fights/actions/interfaces/alterations/weak.ts",
		"src/core/fights/actions/interfaces/players/benediction.ts",
		"src/core/fights/actions/interfaces/players/boomerangAttack.ts",
		"src/core/fights/actions/interfaces/players/breathTakingAttack.ts",
		"src/core/fights/actions/interfaces/players/canonAttack.ts",
		"src/core/fights/actions/interfaces/players/chargeChargingAttack.ts",
		"src/core/fights/actions/interfaces/players/chargeUltimateAttack.ts",
		"src/core/fights/actions/interfaces/players/chargingAttack.ts",
		"src/core/fights/actions/interfaces/players/concentration.ts",
		"src/core/fights/actions/interfaces/players/counterAttack.ts",
		"src/core/fights/actions/interfaces/players/cursedAttack.ts",
		"src/core/fights/actions/interfaces/players/darkAttack.ts",
		"src/core/fights/actions/interfaces/players/defenseBuff.ts",
		"src/core/fights/actions/interfaces/players/divineAttack.ts",
		"src/core/fights/actions/interfaces/players/energeticAttack.ts",
		"src/core/fights/actions/interfaces/players/fireAttack.ts",
		"src/core/fights/actions/interfaces/players/heavyAttack.ts",
		"src/core/fights/actions/interfaces/players/intenseAttack.ts",
		"src/core/fights/actions/interfaces/players/none.ts",
		"src/core/fights/actions/interfaces/players/piercingAttack.ts",
		"src/core/fights/actions/interfaces/players/poisonousAttack.ts",
		"src/core/fights/actions/interfaces/players/powerfulAttack.ts",
		"src/core/fights/actions/interfaces/players/protection.ts",
		"src/core/fights/actions/interfaces/players/quickAttack.ts",
		"src/core/fights/actions/interfaces/players/ramAttack.ts",
		"src/core/fights/actions/interfaces/players/resting.ts",
		"src/core/fights/actions/interfaces/players/sabotageAttack.ts",
		"src/core/fights/actions/interfaces/players/shieldAttack.ts",
		"src/core/fights/actions/interfaces/players/simpleAttack.ts",
		"src/core/fights/actions/interfaces/players/ultimateAttack.ts",
		"src/core/fights/actions/templates/SimpleAlterationFightActionTemplate.ts",
		"src/core/fights/actions/templates/SimpleBuffFightActionTemplate.ts",
		"src/core/fights/actions/templates/SimpleDamageFightActionTemplate.ts",
		"src/core/fights/fighter/AiPlayerFighter.ts",
		"src/core/fights/fighter/Fighter.ts",
		"src/core/fights/fighter/MonsterFighter.ts",
		"src/core/fights/fighter/PlayerBaseFighter.ts",
		"src/core/fights/fighter/PlayerFighter.ts",
		"src/core/missions/MissionsController.ts"
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
