import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { HomeGardenSlot as HomeGardenSlotType } from "../../src/core/database/game/models/HomeGardenSlot";
import type { HomePlantStorage as HomePlantStorageType } from "../../src/core/database/game/models/HomePlantStorage";
import type { Material as MaterialType } from "../../src/core/database/game/models/Material";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";
import {
	PlantConstants, PlantId
} from "../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../Lib/src/constants/TimeConstants";
import { CookingOutputType } from "../../../Lib/src/constants/CookingConstants";

type ReportCookingServiceModule = typeof import("../../src/core/report/ReportCookingService");
type ReportGardenServiceModule = typeof import("../../src/core/report/ReportGardenService");
type CookingServiceModule = typeof import("../../src/core/cooking/CookingService");
type HomePlantStorageModule = typeof import("../../src/core/database/game/models/HomePlantStorage");
type MaterialModule = typeof import("../../src/core/database/game/models/Material");

const N_CONCURRENT = 6;
const RARE_WOOD_ID = 18;
const HOME_LEVEL_WITH_COOKING_AND_GARDEN = 8;

/**
 * Resources must never be duplicated by concurrent requests of the same player: furnace wood, recipe ingredients,
 * harvested plants and composted plants are each consumed or granted exactly once.
 */
describe("cooking and garden resources under concurrent requests", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let HomeGardenSlot: ModelStatic<HomeGardenSlotType>;
	let HomePlantStorage: ModelStatic<HomePlantStorageType>;
	let Material: ModelStatic<MaterialType>;
	let reportCooking: ReportCookingServiceModule;
	let reportGarden: ReportGardenServiceModule;
	let cooking: CookingServiceModule["CookingService"];
	let plantStorages: HomePlantStorageModule["HomePlantStorages"];
	let materials: MaterialModule["Materials"];

	beforeAll(async () => {
		env = await setupCoreForTests("cookinggardenresources");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		HomeGardenSlot = models.HomeGardenSlot as ModelStatic<HomeGardenSlotType>;
		HomePlantStorage = models.HomePlantStorage as ModelStatic<HomePlantStorageType>;
		Material = models.Material as ModelStatic<MaterialType>;
		reportCooking = loadProductionModule<ReportCookingServiceModule>("core/report/ReportCookingService");
		reportGarden = loadProductionModule<ReportGardenServiceModule>("core/report/ReportGardenService");
		cooking = loadProductionModule<CookingServiceModule>("core/cooking/CookingService").CookingService;
		plantStorages = loadProductionModule<HomePlantStorageModule>("core/database/game/models/HomePlantStorage").HomePlantStorages;
		materials = loadProductionModule<MaterialModule>("core/database/game/models/Material").Materials;
		await pinInertDailyMission(env);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	async function createHomeOwner(keycloakId: string): Promise<{ player: PlayerType; home: HomeType }> {
		const player = await Player.create({
			keycloakId, level: 50
		});
		await env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo.create({ playerId: player.id });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "resources-city",
			level: HOME_LEVEL_WITH_COOKING_AND_GARDEN
		});
		return {
			player, home
		};
	}

	function contextOf(keycloakId: string): PacketContext {
		return {
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
		} as PacketContext;
	}

	async function materialQuantity(playerId: number, materialId: number): Promise<number> {
		return (await Material.findOne({
			where: {
				playerId, materialId
			}
		}))?.quantity ?? 0;
	}

	async function storedPlants(homeId: number): Promise<number> {
		return (await HomePlantStorage.findAll({ where: { homeId } }))
			.reduce((sum, entry) => sum + entry.quantity, 0);
	}

	it("burns a confirmed rare wood exactly once whatever the number of concurrent confirmations", async () => {
		const keycloakId = "rare-wood-confirm";
		const { player } = await createHomeOwner(keycloakId);
		await materials.giveMaterial(player.id, RARE_WOOD_ID, 3);

		const [question] = await reportCooking.handleCookingIgnite(keycloakId, {});
		expect(question).toMatchObject({ woodMaterialId: RARE_WOOD_ID });

		const responses = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () =>
			reportCooking.handleCookingWoodConfirm(keycloakId, { accepted: true })));

		expect(responses.filter(response => response.length > 0)).toHaveLength(1);
		expect(await materialQuantity(player.id, RARE_WOOD_ID)).toBe(2);
		expect((await Player.findByPk(player.id))?.furnacePosition).toBe(player.furnacePosition + 1);
	});

	/*
	 * Bug: CookingService.executeCraft consumes the ingredients outside of any player lock (only time potions take it),
	 * so concurrent crafts validated on the same stock all run: each one grants its output and its cooking XP while the
	 * plant storage is read-modify-written by all of them, and the late ones throw from consumeMaterials after their
	 * plants were consumed. Observed: 4 crafts out of 6 cooked from a single set of ingredients.
	 */
	it.fails("never cooks more recipes than the ingredients allow under concurrent crafts", async () => {
		const keycloakId = "concurrent-crafts";
		const {
			player, home
		} = await createHomeOwner(keycloakId);
		const cookingSlots = home.getLevel()?.features.cookingSlots ?? 0;
		const slot = (await cooking.getSlotRecipes({
			player, homeId: home.id, cookingSlots
		})).find(candidate => candidate.recipe?.outputType === CookingOutputType.MATERIAL && candidate.recipe.ingredients.plants.length > 0);
		if (!slot?.recipe) {
			throw new Error("The furnace should offer a material recipe with plants");
		}

		// Ingredients for a single craft
		for (const plant of slot.recipe.ingredients.plants) {
			await plantStorages.addPlant(home.id, plant.plantId as PlantId, plant.quantity, 999);
		}
		for (const material of slot.recipe.ingredients.materials) {
			await materials.giveMaterial(player.id, material.materialId, material.quantity);
		}

		const results = await Promise.allSettled(Array.from({ length: N_CONCURRENT }, () => reportCooking.handleCookingCraft(keycloakId, {
			slotIndex: slot.slotIndex, recipeId: slot.recipe?.id ?? ""
		}, contextOf(keycloakId))));

		const cooked = results.filter(result => result.status === "fulfilled" && (result.value[0] as { error?: string }).error === undefined);
		expect(cooked.length).toBeLessThanOrEqual(1);
	});

	it("stores a ready plant exactly once under concurrent harvests", async () => {
		const keycloakId = "concurrent-harvests";
		const {
			player, home
		} = await createHomeOwner(keycloakId);
		const gardenPlots = HomeLevel.getByLevel(HOME_LEVEL_WITH_COOKING_AND_GARDEN)?.features.gardenPlots ?? 0;
		expect(gardenPlots).toBeGreaterThan(0);
		await HomeGardenSlot.bulkCreate(Array.from({ length: gardenPlots }, (_unused, slot) => ({
			homeId: home.id,
			slot,
			plantId: slot === 0 ? PlantId.COMMON_HERB : 0,
			plantedAt: slot === 0 ? new Date(Date.now() - TimeConstants.MS_TIME.WEEK) : null
		})));

		const responses = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, async () => {
			const response: CrowniclesPacket[] = [];
			await reportGarden.handleGardenHarvest(player.keycloakId, {}, response);
			return response[0] as unknown as { harvestedSlots: number[] }; // The first packet always answers the harvest
		}));

		expect(responses.flatMap(response => response.harvestedSlots)).toEqual([0]);
		expect(await storedPlants(home.id)).toBe(1);
		const replanted = await HomeGardenSlot.findOne({
			where: {
				homeId: home.id, slot: 0
			}
		});
		expect(replanted?.plantId).toBe(PlantId.COMMON_HERB);
		expect(replanted?.plantedAt?.valueOf()).toBeGreaterThan(Date.now() - TimeConstants.MS_TIME.HOUR);
	});

	it("grants the materials of composted plants exactly once under concurrent composts", async () => {
		const keycloakId = "concurrent-composts";
		const {
			player, home
		} = await createHomeOwner(keycloakId);
		const plantsToCompost = 3;
		await plantStorages.addPlant(home.id, PlantId.IRON_ROOT, plantsToCompost, 999);
		const compostPool = PlantConstants.getPlantById(PlantId.IRON_ROOT)?.compostMaterials ?? [];

		const responses = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, async () => {
			const response: CrowniclesPacket[] = [];
			await reportGarden.handleGardenCompostReaction(player, PlantId.IRON_ROOT, plantsToCompost, response);
			return response[0] as unknown as { materials?: number[] }; // The first packet always answers the compost
		}));

		expect(responses.filter(response => response.materials)).toHaveLength(1);
		expect(await storedPlants(home.id)).toBe(0);
		let granted = 0;
		for (const materialId of compostPool) {
			granted += await materialQuantity(player.id, materialId);
		}
		expect(granted).toBe(plantsToCompost);
	});
});
