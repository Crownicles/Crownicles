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
import { getCookingGrade } from "../../../Lib/src/constants/CookingConstants";
import { CookingCraftErrors } from "../../../Lib/src/types/CookingTypes";

type ReportCookingServiceModule = typeof import("../../src/core/report/ReportCookingService");
type CookingServiceModule = typeof import("../../src/core/cooking/CookingService");
type MaterialModule = typeof import("../../src/core/database/game/models/Material");
type HomePlantStorageModule = typeof import("../../src/core/database/game/models/HomePlantStorage");

const KEYCLOAK_ID = "cooking-grade-up";
const LEVEL_BEFORE_GRADE = 10;

describe("cooking craft reaching a new grade", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let reportCooking: ReportCookingServiceModule;
	let cooking: CookingServiceModule["CookingService"];
	let materials: MaterialModule["Materials"];
	let plantStorages: HomePlantStorageModule["HomePlantStorages"];

	beforeAll(async () => {
		env = await setupCoreForTests("cookinggradeup");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Home = env.crownicles.gameDatabase.sequelize.models.Home as ModelStatic<HomeType>;
		reportCooking = loadProductionModule<ReportCookingServiceModule>("core/report/ReportCookingService");
		cooking = loadProductionModule<CookingServiceModule>("core/cooking/CookingService").CookingService;
		materials = loadProductionModule<MaterialModule>("core/database/game/models/Material").Materials;
		plantStorages = loadProductionModule<HomePlantStorageModule>("core/database/game/models/HomePlantStorage").HomePlantStorages;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	type GradeUpCraft = {
		player: PlayerType;
		context: PacketContext;
		craftPacket: {
			slotIndex: number;
			recipeId: string;
		};
	};

	async function prepareGradeUpCraft(keycloakId: string, pinCraftedRecipe: boolean): Promise<GradeUpCraft> {
		const player = await Player.create({
			keycloakId,
			level: 50,
			cookingLevel: LEVEL_BEFORE_GRADE
		});
		player.cookingExperience = cooking.getXpNeededForLevel(LEVEL_BEFORE_GRADE) - 1;
		await player.save();
		const models = env.crownicles.gameDatabase.sequelize.models;
		await models.PlayerMissionsInfo.create({ playerId: player.id });
		await models.MissionSlot.create({
			playerId: player.id,
			missionId: "reachCookingLevel",
			missionVariant: 0,
			missionObjective: LEVEL_BEFORE_GRADE + 1,
			numberDone: LEVEL_BEFORE_GRADE,
			expiresAt: null,
			gemsToWin: 4,
			pointsToWin: 0,
			xpToWin: 250,
			moneyToWin: 0
		});
		const home = await Home.create({
			ownerId: player.id,
			cityId: "cooking-test-city",
			level: 8
		});
		const cookingSlots = home.getLevel()!.features.cookingSlots;
		expect(cookingSlots).toBeGreaterThan(0);
		let slot = (await cooking.getSlotRecipes({
			player, homeId: home.id, cookingSlots
		})).find(candidate => candidate.recipe)!;
		if (pinCraftedRecipe) {
			// Pinning anchors the recipe in a slot of its own, so look it up again afterwards
			player.pinnedCookingRecipeId = slot.recipe!.id;
			await player.save();
			const pinnedRecipeId = slot.recipe!.id;
			slot = (await cooking.getSlotRecipes({
				player, homeId: home.id, cookingSlots
			})).find(candidate => candidate.recipe?.id === pinnedRecipeId)!;
		}
		for (const plant of slot.recipe!.ingredients.plants) {
			await plantStorages.addPlant(home.id, plant.plantId as never, plant.quantity, 999);
		}
		for (const material of slot.recipe!.ingredients.materials) {
			await materials.giveMaterial(player.id, material.materialId, material.quantity);
		}
		return {
			player,
			context: {
				frontEndOrigin: "discord",
				frontEndSubOrigin: "guild",
				keycloakId,
				discord: {
					user: keycloakId,
					interaction: "interaction",
					channel: "channel",
					language: "fr",
					shardId: 0
				}
			} as PacketContext,
			craftPacket: {
				slotIndex: slot.slotIndex,
				recipeId: slot.recipe!.id
			}
		};
	}

	function expectGradeUpResponse(response: unknown[]): void {
		expect(response[0]).toMatchObject({
			cookingLevelUp: true,
			newCookingLevel: LEVEL_BEFORE_GRADE + 1,
			newCookingGrade: getCookingGrade(LEVEL_BEFORE_GRADE + 1).id,
			error: undefined
		});
	}

	it("answers with the level up when the craft reaches a new grade", async () => {
		const {
			player, context, craftPacket
		} = await prepareGradeUpCraft(KEYCLOAK_ID, false);

		expectGradeUpResponse(await reportCooking.handleCookingCraft(KEYCLOAK_ID, craftPacket, context));

		// Clicking the same button again from the stale menu is what displayed "craftUnavailable"
		const staleResponse = await reportCooking.handleCookingCraft(KEYCLOAK_ID, craftPacket, context);
		expect(staleResponse[0]).toMatchObject({ error: CookingCraftErrors.CRAFT_UNAVAILABLE });
		expect((await Player.findByPk(player.id))!.cookingLevel).toBe(LEVEL_BEFORE_GRADE + 1);
	});

	it("answers when the crafted recipe was pinned instead of failing the mission update", async () => {
		const keycloakId = `${KEYCLOAK_ID}-pinned`;
		const {
			player, context, craftPacket
		} = await prepareGradeUpCraft(keycloakId, true);

		expectGradeUpResponse(await reportCooking.handleCookingCraft(keycloakId, craftPacket, context));
		expect((await Player.findByPk(player.id))!.pinnedCookingRecipeId).toBeNull();
	});
});
