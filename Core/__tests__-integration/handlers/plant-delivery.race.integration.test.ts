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
	GARDENER_INTERACTIONS, PLANT_RECEPTION_FAILURES, PLANT_SLOT_TYPE, PlantConstants, PlantId, SEED_CONDITION_FAILURE
} from "../../../Lib/src/constants/PlantConstants";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";
import { ShopItemType } from "../../../Lib/src/constants/LogsConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import type { SmallEventGardenerPacket } from "../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import {
	type CommandShopGenericPurchase, type CommandShopNoPlantSlotAvailable, ReactionCollectorShopItemReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorShop";
import type {
	ReactionCollectorCreationPacket, ReactionCollectorReactPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import type { CommandReportPlantTransferReq } from "../../../Lib/src/packets/commands/CommandReportPacket";
import type { City } from "../../src/data/City";

type PlantDeliveryUtilsModule = typeof import("../../src/core/utils/PlantDeliveryUtils");
type HerbalistShopItemsModule = typeof import("../../src/core/utils/HerbalistShopItems");
type GardenerModule = typeof import("../../src/core/smallEvents/gardener");
type WithLockedPlayerAndMissionsModule = typeof import("../../src/core/utils/withLockedPlayerAndMissions");
type ReportCityShopServiceModule = typeof import("../../src/core/report/ReportCityShopService");
type ReportGardenServiceModule = typeof import("../../src/core/report/ReportGardenService");
type ReactionsCollectorModule = typeof import("../../src/core/utils/ReactionsCollector");

const N_CONCURRENT = 25;
const DELIVERED_PLANT = PlantId.LUNAR_MOSS;
const NO_CONTEXT = {} as PacketContext;
const HERBALIST_CITY = { id: "coco_village" } as City;
const NO_GARDEN_HOME_LEVEL = HomeLevel.getInitialLevel().level;

/**
 * Smallest home level with a garden: the chest only gives access to the home plant storage from there on
 */
function getSmallestGardenHomeLevel(): number {
	let level = NO_GARDEN_HOME_LEVEL;
	while (HomeLevel.getByLevel(level)!.features.gardenPlots === 0) {
		level++;
	}
	return level;
}

const GARDEN_HOME_LEVEL = getSmallestGardenHomeLevel();

/**
 * Integration tests for the magic link between the plant inventory and the home plant storage, granted by the
 * last tanner plant slot upgrade. Asserts the persisted state after each flow: plants go to the chest first,
 * the plant slots only take the rest, a delivery is all or nothing, concurrent deliveries never overfill the
 * chest nor give the same empty slot twice, and a herbalist purchase is paid exactly once for what is delivered.
 */
describe("Plant inventory linked to the home plant storage", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let PlayerPlantSlot: ModelStatic<PlayerPlantSlotType>;
	let HomePlantStorage: ModelStatic<HomePlantStorageType>;
	let plantDelivery: PlantDeliveryUtilsModule;
	let herbalistShopItems: HerbalistShopItemsModule;
	let gardener: GardenerModule;
	let lockedPlayerAndMissions: WithLockedPlayerAndMissionsModule;
	let cityShopService: ReportCityShopServiceModule;
	let gardenService: ReportGardenServiceModule;
	let reactionsCollector: ReactionsCollectorModule;
	let keycloakCounter = 0;

	const storageCapacity = HomeLevel.getByLevel(GARDEN_HOME_LEVEL)!.features.gardenPlantStorageCapacity;
	const linkedCapacity = storageCapacity + PlantConstants.MAX_PLANT_SLOTS;

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
		gardener = loadProductionModule<GardenerModule>("core/smallEvents/gardener");
		lockedPlayerAndMissions = loadProductionModule<WithLockedPlayerAndMissionsModule>("core/utils/withLockedPlayerAndMissions");
		cityShopService = loadProductionModule<ReportCityShopServiceModule>("core/report/ReportCityShopService");
		gardenService = loadProductionModule<ReportGardenServiceModule>("core/report/ReportGardenService");
		reactionsCollector = loadProductionModule<ReactionsCollectorModule>("core/utils/ReactionsCollector");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE player_plant_slots");
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE home_plant_storage");
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE player_talismans");
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
		plantSlots: number; withHome: boolean; money?: number; homeLevel?: number;
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
				level: params.homeLevel ?? GARDEN_HOME_LEVEL
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

	async function getMoney(playerId: number): Promise<number> {
		return (await Player.findByPk(playerId))!.money;
	}

	async function countAllPlants(playerId: number): Promise<number> {
		const home = await Home.findOne({ where: { ownerId: playerId } });
		const stored = home ? await HomePlantStorage.sum("quantity", { where: { homeId: home.id } }) : 0;
		return (stored || 0) + (await getCarriedPlants(playerId)).length;
	}

	async function fillHomeStorage(playerId: number, plantId: PlantId, quantity: number): Promise<void> {
		const home = await Home.findOne({ where: { ownerId: playerId } });
		await HomePlantStorage.create({
			homeId: home!.id,
			plantId,
			quantity
		});
	}

	async function fillPlantSlots(playerId: number, plantId: PlantId): Promise<void> {
		await PlayerPlantSlot.bulkCreate(Array.from({ length: PlantConstants.MAX_PLANT_SLOTS }, (_unused, slot) => ({
			playerId,
			slotType: PLANT_SLOT_TYPE.PLANT,
			slot,
			plantId
		})));
	}

	describe("givePlantsToPlayer", () => {
		it("sends the plants to the home storage first, then to the plant slots, once linked", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});

			const result = await plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: storageCapacity + 2
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

			const result = await plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: 1
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

			const result = await plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: PlantConstants.MAX_PLANT_SLOTS
			});

			expect(result).toEqual({
				delivered: true, toHomeStorage: 0, toPlantSlots: PlantConstants.MAX_PLANT_SLOTS
			});
			expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
		});

		it("keeps the plants in the plant slots while the home has no garden, its chest not showing any plant", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, homeLevel: NO_GARDEN_HOME_LEVEL
			});

			const result = await plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: PlantConstants.MAX_PLANT_SLOTS
			});

			expect(result).toEqual({
				delivered: true, toHomeStorage: 0, toPlantSlots: PlantConstants.MAX_PLANT_SLOTS
			});
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
			expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
		});

		it("gives nothing when the whole quantity does not fit, and tells why", async () => {
			const linkedPlayer = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});
			const playerWithHome = await createPlayer({
				plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS, withHome: true
			});
			const playerWithoutHome = await createPlayer({
				plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS, withHome: false
			});
			const playerWithoutGarden = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, homeLevel: NO_GARDEN_HOME_LEVEL
			});

			const results = await Promise.all([
				plantDelivery.givePlantsToPlayer(linkedPlayer, {
					plantId: DELIVERED_PLANT, amount: linkedCapacity + 1
				}),
				plantDelivery.givePlantsToPlayer(playerWithHome, {
					plantId: DELIVERED_PLANT, amount: PlantConstants.DEFAULT_PLANT_SLOTS + 1
				}),
				plantDelivery.givePlantsToPlayer(playerWithoutHome, {
					plantId: DELIVERED_PLANT, amount: PlantConstants.DEFAULT_PLANT_SLOTS + 1
				}),
				plantDelivery.givePlantsToPlayer(playerWithoutGarden, {
					plantId: DELIVERED_PLANT, amount: PlantConstants.MAX_PLANT_SLOTS + 1
				})
			]);

			expect(results).toEqual([
				{
					delivered: false, reason: PLANT_RECEPTION_FAILURES.HOME_STORAGE_FULL
				},
				{
					delivered: false, reason: PLANT_RECEPTION_FAILURES.PLANT_SLOTS_FULL
				},
				{
					delivered: false, reason: PLANT_RECEPTION_FAILURES.NO_HOME
				},
				{
					delivered: false, reason: PLANT_RECEPTION_FAILURES.NO_GARDEN
				}
			]);
			for (const player of [linkedPlayer, playerWithHome, playerWithoutHome, playerWithoutGarden]) {
				expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
				expect(await getCarriedPlants(player.id)).toEqual([]);
			}
		});

		it(`never delivers more than the chest and the slots can hold under N=${N_CONCURRENT} concurrent deliveries`, async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});

			const results = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: 1
			})));

			expect(results.filter(result => result.delivered)).toHaveLength(linkedCapacity);
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(storageCapacity);
			expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
		});
	});

	describe("isPlantInventoryLinkedToHome", () => {
		it("links the plant inventory only with the last tanner upgrade and a home with a garden", async () => {
			const playerWithHome = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});
			const playerWithoutGarden = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, homeLevel: NO_GARDEN_HOME_LEVEL
			});
			const home = await Home.findOne({ where: { ownerId: playerWithHome.id } });
			const homeWithoutGarden = await Home.findOne({ where: { ownerId: playerWithoutGarden.id } });

			expect(plantDelivery.isPlantInventoryLinkedToHome(PlantConstants.MAX_PLANT_SLOTS, home)).toBe(true);
			expect(plantDelivery.isPlantInventoryLinkedToHome(PlantConstants.MAX_PLANT_SLOTS - 1, home)).toBe(false);
			expect(plantDelivery.isPlantInventoryLinkedToHome(PlantConstants.MAX_PLANT_SLOTS, null)).toBe(false);
			expect(plantDelivery.isPlantInventoryLinkedToHome(PlantConstants.MAX_PLANT_SLOTS, homeWithoutGarden)).toBe(false);
		});
	});

	describe("herbalist weekly plants", () => {
		const plant = PlantConstants.getPlantById(DELIVERED_PLANT)!;
		const unitPrice = PlantConstants.getHerbalistPrice(plant);

		it("lets a linked player buy every plant they can receive and afford, and charges exactly that", async () => {
			const initialMoney = unitPrice * (linkedCapacity + 1);
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: initialMoney
			});

			const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);
			expect(item.id).toBe(ShopItemType.WEEKLY_PLANT_TIER_1);
			expect(item.amounts).toEqual(PlantConstants.getHerbalistAmounts(linkedCapacity));

			const result = await item.buyCallback([], player.id, NO_CONTEXT, linkedCapacity);

			expect(result).toEqual({
				success: true, currencySpent: true, plantsSentToHomeStorage: storageCapacity
			});
			expect(await getMoney(player.id)).toBe(initialMoney - unitPrice * linkedCapacity);
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(storageCapacity);
			expect(await getCarriedPlants(player.id)).toHaveLength(PlantConstants.MAX_PLANT_SLOTS);
		});

		it("lets a player without the home storage link fill all their empty plant slots at once", async () => {
			const plantSlots = PlantConstants.MAX_PLANT_SLOTS - 1;
			const initialMoney = unitPrice * linkedCapacity;
			const player = await createPlayer({
				plantSlots, withHome: true, money: initialMoney
			});

			const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);
			expect(item.amounts).toEqual(PlantConstants.getHerbalistAmounts(plantSlots));

			const result = await item.buyCallback([], player.id, NO_CONTEXT, plantSlots);

			expect(result).toEqual({
				success: true, currencySpent: true
			});
			expect(await getMoney(player.id)).toBe(initialMoney - unitPrice * plantSlots);
			expect(await getCarriedPlants(player.id)).toEqual(Array(plantSlots).fill(DELIVERED_PLANT));
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
		});

		it("never offers more plants than the player can afford", async () => {
			const affordablePlants = 2;
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: unitPrice * affordablePlants
			});

			const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);

			expect(item.amounts).toEqual(PlantConstants.getHerbalistAmounts(affordablePlants));
		});

		it("checks the money again under the lock and delivers nothing when it is no longer enough", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: unitPrice * linkedCapacity
			});
			const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);
			const lowerMoney = unitPrice * linkedCapacity - 1;
			await Player.update({ money: lowerMoney }, { where: { id: player.id } });

			const response: CrowniclesPacket[] = [];
			const result = await item.buyCallback(response, player.id, NO_CONTEXT, linkedCapacity);

			expect(result).toEqual({ success: false });
			expect(response.map(packet => packet.constructor.name)).toContain("CommandShopNotEnoughCurrency");
			expect(await getMoney(player.id)).toBe(lowerMoney);
			expect(await getStoredQuantity(player.id, DELIVERED_PLANT)).toBe(0);
			expect(await getCarriedPlants(player.id)).toEqual([]);
		});

		it(`charges exactly the delivered plants under N=${N_CONCURRENT} concurrent purchases`, async () => {
			const affordablePlants = 3;
			const initialMoney = unitPrice * affordablePlants;
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: initialMoney
			});
			const [item] = await herbalistShopItems.getWeeklyPlantShopItems(player, [plant]);

			const results = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => item.buyCallback([], player.id, NO_CONTEXT, 1)));

			const deliveredPlants = await getStoredQuantity(player.id, DELIVERED_PLANT) + (await getCarriedPlants(player.id)).length;
			expect(results.filter(result => typeof result !== "boolean" && result.success)).toHaveLength(affordablePlants);
			expect(deliveredPlants).toBe(affordablePlants);
			expect(await getMoney(player.id)).toBe(initialMoney - unitPrice * deliveredPlants);
		});
	});

	describe("herbalist through the shop collector", () => {
		const plant = PlantConstants.getWeeklyHerbalistPlants()[0];
		const unitPrice = PlantConstants.getHerbalistPrice(plant);

		/**
		 * Open the herbalist like the city menu does, then click the given amount of the first weekly plant: the
		 * collector end callback runs the real ShopUtils purchase flow (price, debit, purchase packet)
		 */
		async function buyAtHerbalist(player: PlayerType, pickAmount: (amounts: number[]) => number): Promise<{
			response: CrowniclesPacket[]; amount: number;
		}> {
			const openingResponse: CrowniclesPacket[] = [];
			await cityShopService.openHerbalist({
				player,
				city: HERBALIST_CITY,
				context: { keycloakId: player.keycloakId } as PacketContext,
				response: openingResponse,
				onClose: () => Promise.resolve()
			});
			const shop = openingResponse.find(packet => packet.constructor.name === "ReactionCollectorCreationPacket") as ReactionCollectorCreationPacket;
			const plantReactions = shop.reactions
				.map((reaction, index) => ({
					data: reaction.data as ReactionCollectorShopItemReaction,
					type: reaction.type,
					index
				}))
				.filter(reaction => reaction.type === ReactionCollectorShopItemReaction.name && reaction.data.shopItemId === ShopItemType.WEEKLY_PLANT_TIER_1);
			const amount = pickAmount(plantReactions.map(reaction => reaction.data.amount));

			const response: CrowniclesPacket[] = [];
			await reactionsCollector.ReactionCollectorController.reactPacket(response, {
				id: shop.id,
				keycloakId: player.keycloakId,
				reactionIndex: plantReactions.find(reaction => reaction.data.amount === amount)!.index
			} as ReactionCollectorReactPacket);
			return {
				response, amount
			};
		}

		it("debits exactly the unit price times the bought amount and reports what was delivered", async () => {
			const initialMoney = unitPrice * (linkedCapacity + 1);
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: initialMoney
			});

			const {
				response, amount
			} = await buyAtHerbalist(player, amounts => Math.max(...amounts));

			expect(amount).toBe(linkedCapacity);
			const purchase = response.find(packet => packet.constructor.name === "CommandShopGenericPurchase") as CommandShopGenericPurchase;
			expect(purchase).toMatchObject({
				shopItemId: ShopItemType.WEEKLY_PLANT_TIER_1,
				amount,
				plantsSentToHomeStorage: storageCapacity
			});
			expect(await getMoney(player.id)).toBe(initialMoney - unitPrice * amount);
			expect(await getStoredQuantity(player.id, plant.id) + (await getCarriedPlants(player.id)).length).toBe(amount);
		});

		it("leaves the balance unchanged when the plants cannot be delivered", async () => {
			const initialMoney = unitPrice * linkedCapacity;
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true, money: initialMoney
			});
			await fillHomeStorage(player.id, plant.id, storageCapacity);
			await fillPlantSlots(player.id, PlantId.ANCIENT_TREE);

			const {
				response, amount
			} = await buyAtHerbalist(player, amounts => Math.min(...amounts));

			expect(amount).toBe(1);
			const failure = response.find(packet => packet.constructor.name === "CommandShopNoPlantSlotAvailable") as CommandShopNoPlantSlotAvailable;
			expect(failure.reason).toBe(PLANT_RECEPTION_FAILURES.HOME_STORAGE_FULL);
			expect(response.some(packet => packet.constructor.name === "CommandShopGenericPurchase")).toBe(false);
			expect(await getMoney(player.id)).toBe(initialMoney);
			expect(await getStoredQuantity(player.id, plant.id)).toBe(storageCapacity);
		});
	});

	describe("gardener plant gift", () => {
		async function receiveGardenerPlant(player: PlayerType): Promise<SmallEventGardenerPacket> {
			const additionalLockKeys = await gardener.smallEventFuncs.getAdditionalLockKeys!(player);
			return await lockedPlayerAndMissions.withLockedPlayerAndMissions(
				player.id,
				lockedPlayer => gardener.handlePlantGift(lockedPlayer),
				additionalLockKeys
			);
		}

		it("sends the gifted plant to the home storage of a linked player, under the small event lock", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});

			const packet = await receiveGardenerPlant(player);

			expect(packet.interactionName).toBe(GARDENER_INTERACTIONS.PLANT);
			expect(packet.sentToHomeStorage).toBe(true);
			expect(await getStoredQuantity(player.id, packet.plantId)).toBe(1);
			expect(await getCarriedPlants(player.id)).toEqual([]);
		});

		it("keeps the gifted plant in the plant slots of an unlinked player", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS, withHome: true
			});

			const packet = await receiveGardenerPlant(player);

			expect(packet.interactionName).toBe(GARDENER_INTERACTIONS.PLANT);
			expect(packet.sentToHomeStorage).toBeUndefined();
			expect(await getCarriedPlants(player.id)).toEqual([packet.plantId]);
		});

		it("gives advice instead when there is no room left", async () => {
			const player = await createPlayer({
				plantSlots: PlantConstants.DEFAULT_PLANT_SLOTS, withHome: false
			});
			await plantDelivery.givePlantsToPlayer(player, {
				plantId: DELIVERED_PLANT, amount: PlantConstants.DEFAULT_PLANT_SLOTS
			});

			const packet = await receiveGardenerPlant(player);

			expect(packet.interactionName).toBe(GARDENER_INTERACTIONS.ADVICE);
			expect(packet.conditionKey).toBe(SEED_CONDITION_FAILURE.NO_PLANT_SPACE);
			expect(await getCarriedPlants(player.id)).toEqual([DELIVERED_PLANT]);
		});
		it(`runs concurrently with chest plant transfers without deadlock nor plant loss (N=${N_CONCURRENT} each)`, async () => {
			const initialStored = 2;
			const player = await createPlayer({
				plantSlots: PlantConstants.MAX_PLANT_SLOTS, withHome: true
			});
			await fillHomeStorage(player.id, DELIVERED_PLANT, initialStored);
			const transfers = Array.from({ length: N_CONCURRENT }, (_unused, index) => ({
				action: index % 2 === 0 ? HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW : HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT,
				plantId: DELIVERED_PLANT,
				playerSlot: 0
			}) as CommandReportPlantTransferReq);

			const [gifts] = await Promise.all([
				runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => receiveGardenerPlant(player))),
				runAllOrThrow(transfers.map(transfer => gardenService.handlePlantTransfer(player.keycloakId, transfer)))
			]);

			const deliveredGifts = gifts.filter(packet => packet.interactionName === GARDENER_INTERACTIONS.PLANT).length;
			expect(await countAllPlants(player.id)).toBe(initialStored + deliveredGifts);
		});
	});
});
