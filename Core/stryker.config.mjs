/**
 * Mutation testing (#5165): checks that the unit tests fail when the code under test changes.
 * Only the files listed in `mutate` are mutated. Add a file once its tests are written.
 * The directories of game rules (mission interfaces, fight actions) are mutated by a glob, so a new file is never forgotten:
 * remove a file from the `!` exclusions at the end once its tests are written.
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
		"src/core/blessings/BlessingManager.ts",
		"src/core/cooking/CookingService.ts",
		"src/core/cooking/CookingSlotRotation.ts",
		"src/core/cooking/RecipeDiscoveryService.ts",
		"src/core/database/game/models/Guild.ts",
		"src/core/database/game/models/InventoryInfo.ts",
		"src/core/database/game/models/InventorySlot.ts",
		"src/core/database/game/models/PetEntity.ts",
		"src/core/database/game/models/Player.ts",
		"src/core/fights/FightController.ts",
		"src/core/fights/actions/FightActionController.ts",
		"src/core/fights/actions/interfaces/alterations/*.ts",
		"src/core/fights/actions/interfaces/players/*.ts",
		"src/core/fights/actions/templates/SimpleAlterationFightActionTemplate.ts",
		"src/core/fights/actions/templates/SimpleBuffFightActionTemplate.ts",
		"src/core/fights/actions/templates/SimpleDamageFightActionTemplate.ts",
		"src/core/fights/fighter/AiPlayerFighter.ts",
		"src/core/fights/fighter/Fighter.ts",
		"src/core/fights/fighter/MonsterFighter.ts",
		"src/core/fights/fighter/PlayerBaseFighter.ts",
		"src/core/fights/fighter/PlayerFighter.ts",
		"src/core/missions/MissionsController.ts",
		"src/core/missions/interfaces/*.ts",
		"src/core/report/ReportBigEventService.ts",
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
		"src/core/report/ReportCookingService.ts",
		"src/core/report/ReportGardenService.ts",
		"src/core/report/ReportPveService.ts",
		"src/core/report/ReportRoyalBlacksmithService.ts",
		"src/core/report/ReportSmallEventService.ts",
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
		"src/core/smallEvents/witch.ts",
		"src/core/utils/BedUtils.ts",
		"src/core/utils/ItemUtils.ts",
		"src/core/utils/ShopUtils.ts",
		"src/core/utils/TannerShopItems.ts",
		// Opt-out for the directories mutated by a glob: a new file is mutated by default. Only exclude a file whose tests are still to write
		"!src/core/fights/actions/interfaces/alterations/alliesArePresent.ts",
		"!src/core/fights/actions/interfaces/alterations/blackCorrosion.ts",
		"!src/core/fights/actions/interfaces/alterations/blind.ts",
		"!src/core/fights/actions/interfaces/alterations/cursedByTheSea.ts",
		"!src/core/fights/actions/interfaces/alterations/dirty.ts",
		"!src/core/fights/actions/interfaces/alterations/outrage.ts",
		"!src/core/fights/actions/interfaces/alterations/petrified.ts",
		"!src/core/fights/actions/interfaces/alterations/sleeping.ts",
		"!src/core/fights/actions/interfaces/alterations/soaked.ts",
		"!src/core/fights/actions/interfaces/alterations/submerged.ts",
		"!src/core/fights/actions/interfaces/alterations/swallowed.ts",
		"!src/core/fights/actions/interfaces/alterations/tetanized.ts",
		"!src/core/fights/actions/interfaces/players/guildAttack.ts",
		"!src/core/fights/actions/interfaces/players/rageExplosion.ts",
		"!src/core/missions/interfaces/bigFeast.ts",
		"!src/core/missions/interfaces/collectMaterials.ts",
		"!src/core/missions/interfaces/cookPotionRarity.ts",
		"!src/core/missions/interfaces/dangerousExpedition.ts",
		"!src/core/missions/interfaces/depositPetInShelter.ts",
		"!src/core/missions/interfaces/drinkAlcohol.ts",
		"!src/core/missions/interfaces/exploreDifferentPlaces.ts",
		"!src/core/missions/interfaces/fromPlaceToPlace.ts",
		"!src/core/missions/interfaces/getAncestralTrees.ts",
		"!src/core/missions/interfaces/meetDifferentPlayers.ts",
		"!src/core/missions/interfaces/meetGruffo.ts",
		"!src/core/missions/interfaces/plantSeed.ts",
		"!src/core/missions/interfaces/reachCookingLevel.ts",
		"!src/core/missions/interfaces/upgradeEpicItemLevel5.ts",
		"!src/core/missions/interfaces/winAnyBossWithDifferentClasses.ts"
	],
	// Imports reach ../Lib through relative paths that a copied sandbox would break: mutate the files in place (restored at the end)
	inPlace: true,
	coverageAnalysis: "perTest",
	// A static mutant runs the whole suite and took 91 % of the time for 3 % of the mutants: the data tests already cover the module-level constants
	ignoreStatic: true,
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
