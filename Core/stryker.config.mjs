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
		"src/core/database/game/models/Player.ts",
		"src/core/missions/MissionsController.ts",
		"src/core/missions/interfaces/buyApartment.ts",
		"src/core/missions/interfaces/buyApartments.ts",
		"src/core/missions/interfaces/buyHome.ts",
		"src/core/missions/interfaces/buyItemFromAlderic.ts",
		"src/core/missions/interfaces/chooseClass.ts",
		"src/core/missions/interfaces/chooseClassTier.ts",
		"src/core/missions/interfaces/commandFightHistory.ts",
		"src/core/missions/interfaces/contributeToBlessing.ts",
		"src/core/missions/interfaces/doExpeditions.ts",
		"src/core/missions/interfaces/drinkPotionRarity.ts",
		"src/core/missions/interfaces/expeditionStreak.ts",
		"src/core/missions/interfaces/fightAttacks.ts",
		"src/core/missions/interfaces/fightHealthPercent.ts",
		"src/core/missions/interfaces/fightMinTurns.ts",
		"src/core/missions/interfaces/fightStreak.ts",
		"src/core/missions/interfaces/finishWithAttack.ts",
		"src/core/missions/interfaces/goToPlace.ts",
		"src/core/missions/interfaces/guildLevel.ts",
		"src/core/missions/interfaces/haveGardenTalisman.ts",
		"src/core/missions/interfaces/haveItemRarity.ts",
		"src/core/missions/interfaces/havePet.ts",
		"src/core/missions/interfaces/havePotions.ts",
		"src/core/missions/interfaces/joinGuild.ts",
		"src/core/missions/interfaces/joinGuildHouse.ts",
		"src/core/missions/interfaces/longExpedition.ts",
		"src/core/missions/interfaces/maxTokensReached.ts",
		"src/core/missions/interfaces/meetAllOracles.ts",
		"src/core/missions/interfaces/meetOracle.ts",
		"src/core/missions/interfaces/meetSirRowan.ts",
		"src/core/missions/interfaces/meetTalvar.ts",
		"src/core/missions/interfaces/meetVelanna.ts",
		"src/core/missions/interfaces/petAssistedFight.ts",
		"src/core/missions/interfaces/petCaress.ts",
		"src/core/missions/interfaces/reachGlory.ts",
		"src/core/missions/interfaces/reachLevel.ts",
		"src/core/missions/interfaces/reachScore.ts",
		"src/core/missions/interfaces/sellItemWithGivenCost.ts",
		"src/core/missions/interfaces/sellItems.ts",
		"src/core/missions/interfaces/showCloneToTalvar.ts",
		"src/core/missions/interfaces/showPetsToTalvar.ts",
		"src/core/missions/interfaces/tamedPet.ts",
		"src/core/missions/interfaces/trainedPet.ts",
		"src/core/missions/interfaces/travelHours.ts",
		"src/core/missions/interfaces/upgradeHomeLevel.ts",
		"src/core/missions/interfaces/visitCityNpc.ts",
		"src/core/missions/interfaces/winBossWithDifferentClasses.ts",
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
