import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import type { PlayerPlantSlot as PlayerPlantSlotType } from "../../src/core/database/game/models/PlayerPlantSlot";
import type { HomePlantStorage as HomePlantStorageType } from "../../src/core/database/game/models/HomePlantStorage";
import {
	PLANT_SLOT_TYPE, PlantConstants, PlantId
} from "../../../Lib/src/constants/PlantConstants";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";
import { ShopItemType } from "../../../Lib/src/constants/LogsConstants";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import type { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";

type PlantDeliveryUtilsModule = typeof import("../../src/core/utils/PlantDeliveryUtils");
type HerbalistShopItemsModule = typeof import("../../src/core/utils/HerbalistShopItems");

const N_CONCURRENT = 25;
const SMALLEST_HOME_LEVEL = 1;
const DELIVERED_PLANT = PlantId.LUNAR_MOSS;

/**
 * Integration tests for the magic link between the plant inventory and the home plant storage, granted by the
 * last tanner plant slot upgrade. Asserts the persisted state after each delivery: plants go to the chest
 * first, the plant slots only take the rest, a delivery is all or nothing, and concurrent deliveries never
 * overfill the chest nor give the same empty slot twice.
 */
describe("PlantDeliveryUtils.givePlantsToPlayer", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let PlayerPlantSlot: ModelStatic<PlayerPlantSlotType>;
	let HomePlantStorage: ModelStatic<HomePlantStorageType>;
	let plantDelivery: PlantDeliveryUtilsModule;
	let herbalistShopItems: HerbalistShopItemsModule;
	let keycloakCounter = 0;

	const storageCapacity = HomeLevel.getByLevel(SMALLEST_HOME_LEVEL)!.features.gardenPlantStorageCapacity;

	beforeAll(async () => {
		env = await setupCoreForTests("plantdelivery");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		PlayerPlantSlot = models.PlayerPlantSlot as ModelStatic<PlayerPlantSlotType>;
		HomePlantStorage = models.HomePlantStorage as ModelStatic<HomePlantStorageType>;
		plantDelivery = loadProductionModule<PlantDeliveryUtilsModule>("core/utils/PlantDeliveryUtils");
		herbalistShopItems = loadProductionModule<HerbalistShopItemsModule>("core/utils/HerbalistShopItems");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE player_plant_slots");
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE home_plant_storage");
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Home.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function createPlayer(params: {
		plantSlots: number; withHome: boolean; money?: number;
	}): Promise<PlayerType> {
		keycloakCounter++;
		const player = await Player.create({
			keycloakId: `plant-delivery-${keycloakCounter}`,
			money: params.money ?? 0
		});
		await InventoryInfo.create({
			playerId: player.id,
			plantSlots: params.plantSlots
		});
		if (params.withHome) {
			await Home.create({
				ownerId: player.id,
				cityId: "plant-delivery-city",
				level: SMALLEST_HOME_LEVEL
			});
		}
		return player;
	}

	async function getCarriedPlants(playerId: number): Promise<number[]> {
		const slots = await PlayerPlantSlot.findAll({
			where: {
				playerId,
				slotType: PLANT_SLOT_TYPE.PLANT
			}
		});
		return slots.map(slot => slot.plantId).filter(plantId => plantId !== 0);
	}

	async function getStoredQuantity(playerId: number, plantId: PlantId): Promise<number> {
		const home = await Home.findOne({ where: { ownerId: playerId } });
		if (!home) {
			return 0;
		}
		const storage = await HomePlantStorage.findOne({
			where: {
				homeId: home.id,
				plantId
			}
		});
		return storage?.quantity ?? 0;
	}

	it("sends the plants to the home storage first, then to the plant slots, once linked", async () => {
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
		});

		const result = await plantDelivery.givePlantsToPlayer({
			playerId: player.id, plantId: DELIVERED_PLANT, amount: storageCapacity + 2
		});

		expect(result).toEqual({
			delivered: true, toHomeStorage: storageCapacity, toPlantSlots: 2
		});
		expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(storageCapacity);
		expect(await getCarriedPlants(player.id)).toEqual([DELIVERED_PLANT, DELIVERED_PLANT]);
	});

	it("keeps the plants in the plant slots without the last tanner upgrade", async () => {
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS - 1, withHome: true
		});

		const result = await plantDelivery.givePlantsToPlayer({
			playerId: player.id, plantId: DELIVERED_PLANT, amount: 1
		});

		expect(result).toEqual({
			delivered: true, toHomeStorage: 0, toPlantSlots: 1
		});
		expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
		expect(await getCarriedPlants(player.id)).toEqual([DELIVERED_PLANT]);
	});

	it("keeps the plants in the plant slots when the player has no home", async () => {
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: false
		});

		const result = await plantDelivery.givePlantsToPlayer({
			playerId: player.id, plantId: DELIVERED_PLANT, amount: PlantConstants.MAX_PLANT_SLOTS
		});

		expect(result).toEqual({
			delivered: true, toHomeStorage: 0, toPlantSlots: PlantConstants.MAX_PLANT_SLOTS
		});
		expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
	});

	it("gives nothing when the whole quantity does not fit", async () => {
		const linkedPlayer = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
		});
		const unlinkedPlayer = await createPlayer({
			plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS, withHome: true
		});

		const linkedResult = await plantDelivery.givePlantsToPlayer({
			playerId: linkedPlayer.id, plantId: DELIVERED_PLANT, amount: storageCapacity + PlantConstants.MAX_PLANT_SLOTS + 1
		});
		const unlinkedResult = await plantDelivery.givePlantsToPlayer({
			playerId: unlinkedPlayer.id, plantId: DELIVERED_PLANT, amount: PlantConstants.DEFAULT_PLANT_SLOTS + 1
		});

		expect(linkedResult).toEqual({
			delivered: false, linkedToHomeStorage: true
		});
		expect(unlinkedResult).toEqual({
			delivered: false, linkedToHomeStorage: false
		});
		for (const player of [linkedPlayer, unlinkedPlayer]) {
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
			expect(await getCarriedPlants(player.id)).toEqual([]);
		}
	});

	it(`never delivers more than the chest and the slots can hold under N=${N_CONCURRENT} concurrent deliveries`, async () => {
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
		});
		const capacity = storageCapacity + PlantConstants.MAX_PLANT_SLOTS;

		const results = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => plantDelivery.givePlantsToPlayer({
			playerId: player.id, plantId: DELIVERED_PLANT, amount: 1
		})));

		expect(results.filter(result => result.delivered)).toHaveLength(capacity);
		expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(storageCapacity);
		expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
	});

	it("lets a linked player buy every weekly plant they can receive and afford at the herbalist", async () => {
		const plant = PlantConstants.getPlantById(DELIVERED_PLANT)!;
		const unitPrice = PlantConstants.getHerbalistPrice(plant);
		const capacity = storageCapacity + PlantConstants.MAX_PLANT_SLOTS;
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: unitPrice * (capacity + 1)
		});

		const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);
		expect(item.id).toBe(ShopItemType.WEEKLY_PLANT_TIER_1);
		expect(item.amounts).toEqual(PlantConstants.getLinkedHerbalistAmounts(capacity));

		const response: CrowniclesPacket[] = [];
		const result = await item.buyCallback(response, player.id, {} as PacketContext, capacity);

		expect(result).toEqual({
			success: true, plantsSentToHomeStorage: storageCapacity
		});
		expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(storageCapacity);
		expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
	});

	it("only sells plants one at a time without the home storage link", async () => {
		const plant = PlantConstants.getPlantById(DELIVERED_PLANT)!;
		const player = await createPlayer({
			plantSlots: PlantConstants.MAX_PLANT_SLOTS - 1, withHome: true, money: 1_000_000
		});

		const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);

		expect(item.amounts).toEqual([1]);
	});
});
