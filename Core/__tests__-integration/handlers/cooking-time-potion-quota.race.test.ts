import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CookingSpecialtyConstants, SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_CRAFT_LIMIT
} from "../../../Lib/src/constants/CookingConstants";

type ReportCookingServiceModule = typeof import("../../src/core/report/ReportCookingService");
type CookingServiceModule = typeof import("../../src/core/cooking/CookingService");
type MaterialModule = typeof import("../../src/core/database/game/models/Material");
type HomePlantStorageModule = typeof import("../../src/core/database/game/models/HomePlantStorage");

const KEYCLOAK_ID = "time-potion-race";
const TIME_POTION_RECIPE_ID = "potion_time_speedup_3";
const HOME_LEVEL_WITH_FIVE_COOKING_SLOTS = 8;
const CONCURRENT_CRAFTS = 2;

describe("weekly time potion limit under concurrent crafts", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;

	beforeAll(async () => {
		env = await setupCoreForTests("timepotionrace");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("never lets concurrent crafts cook more time potions than the weekly limit", async () => {
		const models = env.crownicles.gameDatabase.sequelize.models;
		const reportCooking = loadProductionModule<ReportCookingServiceModule>("core/report/ReportCookingService");
		const cooking = loadProductionModule<CookingServiceModule>("core/cooking/CookingService").CookingService;
		const materials = loadProductionModule<MaterialModule>("core/database/game/models/Material").Materials;
		const plantStorages = loadProductionModule<HomePlantStorageModule>("core/database/game/models/HomePlantStorage").HomePlantStorages;

		// A master chef with a single time potion left this week, offered as their specialty
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			level: 50,
			cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1],
			timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT - 1
		});
		await models.PlayerMissionsInfo.create({ playerId: player.id });
		await models.PlayerCookingRecipe.create({
			playerId: player.id,
			recipeId: TIME_POTION_RECIPE_ID
		});
		await models.PlayerCookingSpecialty.create({
			playerId: player.id,
			recipeId: TIME_POTION_RECIPE_ID
		});
		const home = await (models.Home as ModelStatic<HomeType>).create({
			ownerId: player.id,
			cityId: "cooking-test-city",
			level: HOME_LEVEL_WITH_FIVE_COOKING_SLOTS
		});
		const timePotionSlot = (await cooking.getSlotRecipes({
			player, homeId: home.id, cookingSlots: home.getLevel()!.features.cookingSlots
		})).find(slot => slot.slotIndex === SPECIALTY_SLOT_INDEX)!;
		expect(timePotionSlot.recipe).toMatchObject({
			id: TIME_POTION_RECIPE_ID,
			timePotionsLeftThisWeek: 1
		});

		// Enough ingredients for every craft, so only the weekly limit can stop them
		for (const plant of timePotionSlot.recipe!.ingredients.plants) {
			await plantStorages.addPlant(home.id, plant.plantId as never, plant.quantity * CONCURRENT_CRAFTS, 999);
		}
		for (const material of timePotionSlot.recipe!.ingredients.materials) {
			await materials.giveMaterial(player.id, material.materialId, material.quantity * CONCURRENT_CRAFTS);
		}

		const context = {
			frontEndOrigin: "discord",
			frontEndSubOrigin: "guild",
			keycloakId: KEYCLOAK_ID,
			discord: {
				user: KEYCLOAK_ID,
				interaction: "interaction",
				channel: "channel",
				language: "fr",
				shardId: 0
			}
		} as PacketContext;
		const responses = await Promise.all(Array.from({ length: CONCURRENT_CRAFTS }, () => reportCooking.handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: SPECIALTY_SLOT_INDEX,
			recipeId: TIME_POTION_RECIPE_ID
		}, context)));

		// The conserved invariant: the persisted count matches the successful crafts and never exceeds the limit
		const successfulCrafts = responses.filter(response => (response[0] as { success: boolean }).success).length;
		expect(successfulCrafts).toBeLessThanOrEqual(1);
		expect((await Player.findByPk(player.id))!.timePotionsCookedThisWeek).toBe(TIME_POTION_WEEKLY_CRAFT_LIMIT - 1 + successfulCrafts);
	});
});
