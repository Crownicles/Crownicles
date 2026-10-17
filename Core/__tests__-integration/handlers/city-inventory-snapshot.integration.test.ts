import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { HomeChestSlot as HomeChestSlotType } from "../../src/core/database/game/models/HomeChestSlot";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type InventoryInfoType from "../../src/core/database/game/models/InventoryInfo";
import type { Material as MaterialType } from "../../src/core/database/game/models/Material";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { RoyalBlacksmithConstants } from "../../../Lib/src/constants/BlacksmithConstants";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";

type ChestServiceModule = typeof import("../../src/core/report/ReportCityChestService");
type CityServiceModule = typeof import("../../src/core/report/ReportCityService");
type BlacksmithDataModule = typeof import("../../src/core/report/ReportBlacksmithService");
type RoyalBlacksmithDataModule = typeof import("../../src/core/report/ReportRoyalBlacksmithService");
type RoyalBlacksmithServiceModule = typeof import("../../src/core/report/ReportCityRoyalBlacksmithService");
type InventorySlotModule = typeof import("../../src/core/database/game/models/InventorySlot");
type EnchanterServiceModule = typeof import("../../src/core/report/ReportCityEnchanterService");

const KEYCLOAK_ID = "city-inventory-snapshot";
const HOME_LEVEL = HomeLevel.LEVEL_8;
const CHEST_SLOT = 1;
const RESERVE_SLOT = 1;
const NO_CHEST_SLOT = -1;
const PLAYER_MONEY = 10_000_000;
const PLAYER_GEMS = 1_000;

// Common weapons the home upgrade station accepts
const SABRE_ID = 2;
const SWORD_ID = 9;

// Epic weapon whose upgrade costs far more than a common one
const EPIC_WEAPON_ID = 1;

/**
 * Regression tests for issue #4789: the city menu is built once, but the home chest can
 * change the inventory while it stays open.
 */
describe("City services after a chest action (issue #4789)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let HomeChestSlot: ModelStatic<HomeChestSlotType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let Material: ModelStatic<MaterialType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let chestService: ChestServiceModule;
	let cityService: CityServiceModule;
	let blacksmithData: BlacksmithDataModule;
	let royalBlacksmithData: RoyalBlacksmithDataModule;
	let royalBlacksmithService: RoyalBlacksmithServiceModule;
	let inventorySlots: InventorySlotModule;
	let enchanterService: EnchanterServiceModule;

	async function setupPlayer(params: {
		equippedWeapon: number;
		chestWeapon: number;
		itemLevel: number;
	}): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			money: PLAYER_MONEY,
			level: RoyalBlacksmithConstants.MIN_PLAYER_LEVEL
		});
		const home = await Home.create({
			ownerId: player.id,
			cityId: "city-inventory-snapshot",
			level: HOME_LEVEL.level
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			gems: PLAYER_GEMS
		});
		await InventoryInfo.create({
			playerId: player.id,
			weaponSlots: RESERVE_SLOT + 1
		});
		await InventorySlot.create({
			playerId: player.id,
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			itemId: params.equippedWeapon,
			itemLevel: params.itemLevel,
			itemEnchantmentId: null
		});
		await HomeChestSlot.create({
			homeId: home.id,
			slot: CHEST_SLOT,
			itemCategory: ItemCategory.WEAPON,
			itemId: params.chestWeapon,
			itemLevel: params.itemLevel,
			itemEnchantmentId: null
		});
		return player;
	}

	async function runChestAction(action: typeof HomeConstants.CHEST_ACTIONS[keyof typeof HomeConstants.CHEST_ACTIONS], slot: number): Promise<void> {
		const result = await chestService.handleChestAction(KEYCLOAK_ID, {
			action,
			slot,
			itemCategory: ItemCategory.WEAPON,
			chestSlot: action === HomeConstants.CHEST_ACTIONS.SWAP ? CHEST_SLOT : NO_CHEST_SLOT
		}, []);
		expect(result.success).toBe(true);
	}

	async function getWeaponSlot(playerId: number, slot: number): Promise<InventorySlotType | null> {
		return await InventorySlot.findOne({
			where: {
				playerId,
				slot,
				itemCategory: ItemCategory.WEAPON
			}
		});
	}

	function packetNames(response: CrowniclesPacket[]): string[] {
		return response.map(packet => packet.constructor.name);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("cityinventorysnapshot");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		HomeChestSlot = models.HomeChestSlot as ModelStatic<HomeChestSlotType>;
		InventorySlot = models.InventorySlot as ModelStatic<InventorySlotType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		Material = models.Material as ModelStatic<MaterialType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		chestService = loadProductionModule<ChestServiceModule>("core/report/ReportCityChestService");
		cityService = loadProductionModule<CityServiceModule>("core/report/ReportCityService");
		blacksmithData = loadProductionModule<BlacksmithDataModule>("core/report/ReportBlacksmithService");
		royalBlacksmithData = loadProductionModule<RoyalBlacksmithDataModule>("core/report/ReportRoyalBlacksmithService");
		royalBlacksmithService = loadProductionModule<RoyalBlacksmithServiceModule>("core/report/ReportCityRoyalBlacksmithService");
		inventorySlots = loadProductionModule<InventorySlotModule>("core/database/game/models/InventorySlot");
		enchanterService = loadProductionModule<EnchanterServiceModule>("core/report/ReportCityEnchanterService");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const model of [HomeChestSlot, InventorySlot, InventoryInfo, Material, PlayerMissionsInfo, Home, Player]) {
				await (model as ModelStatic<PlayerType>).destroy({
					truncate: true, force: true
				});
			}
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("upgrades at home the sword withdrawn from the chest after the city was opened", async () => {
		const player = await setupPlayer({
			equippedWeapon: SABRE_ID,
			chestWeapon: SWORD_ID,
			itemLevel: 0
		});
		const openingData = {
			home: {
				owned: {
					features: HOME_LEVEL.features,
					upgradeStation: cityService.buildUpgradeStationData(await inventorySlots.InventorySlots.getOfPlayer(player.id), new Map(), HOME_LEVEL, player)
				}
			}
		} as unknown as ReactionCollectorCityData;

		await runChestAction(HomeConstants.CHEST_ACTIONS.WITHDRAW, CHEST_SLOT);
		const freshStation = cityService.buildUpgradeStationData(await inventorySlots.InventorySlots.getOfPlayer(player.id), new Map(), HOME_LEVEL, player);
		const withdrawnSword = freshStation.upgradeableItems.find(item => item.slot === RESERVE_SLOT)!;
		for (const material of withdrawnSword.requiredMaterials) {
			await Material.create({
				playerId: player.id,
				materialId: material.materialId,
				quantity: material.quantity
			});
		}

		const response: CrowniclesPacket[] = [];
		await cityService.handleUpgradeItemReaction(player, {
			slot: RESERVE_SLOT,
			itemCategory: ItemCategory.WEAPON
		}, openingData, response);

		expect(packetNames(response)).toContain("CommandReportUpgradeItemRes");
		const swordSlot = await getWeaponSlot(player.id, RESERVE_SLOT);
		expect(swordSlot?.itemId).toBe(SWORD_ID);
		expect(swordSlot?.itemLevel).toBe(1);
	});

	it("refuses a blacksmith upgrade priced for the equipment that was swapped into the chest", async () => {
		const player = await setupPlayer({
			equippedWeapon: SABRE_ID,
			chestWeapon: EPIC_WEAPON_ID,
			itemLevel: 0
		});
		const openingData = {
			blacksmith: blacksmithData.buildBlacksmithData(await inventorySlots.InventorySlots.getOfPlayer(player.id), new Map(), player)
		} as unknown as ReactionCollectorCityData;

		await runChestAction(HomeConstants.CHEST_ACTIONS.SWAP, 0);
		const response: CrowniclesPacket[] = [];
		await cityService.handleBlacksmithUpgradeReaction(player, {
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			buyMaterials: true
		}, openingData, response);

		expect(packetNames(response)).toEqual(["CommandReportEquipmentChangedRes"]);
		await player.reload();
		expect(player.money).toBe(PLAYER_MONEY);
		const epicSlot = await getWeaponSlot(player.id, 0);
		expect(epicSlot?.itemId).toBe(EPIC_WEAPON_ID);
		expect(epicSlot?.itemLevel).toBe(0);
	});

	it("refuses a royal blacksmith upgrade priced for the equipment that was swapped into the chest", async () => {
		const previousLevel = RoyalBlacksmithConstants.TARGET_LEVEL - 1;
		const player = await setupPlayer({
			equippedWeapon: SABRE_ID,
			chestWeapon: EPIC_WEAPON_ID,
			itemLevel: previousLevel
		});
		const openingData = {
			royalBlacksmith: await royalBlacksmithData.buildRoyalBlacksmithData(await inventorySlots.InventorySlots.getOfPlayer(player.id), new Map(), player)
		} as unknown as ReactionCollectorCityData;

		await runChestAction(HomeConstants.CHEST_ACTIONS.SWAP, 0);
		const response: CrowniclesPacket[] = [];
		await royalBlacksmithService.handleRoyalBlacksmithUpgradeReaction(player, {
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			buyMaterials: true
		}, openingData, response);

		expect(packetNames(response)).toEqual(["CommandReportEquipmentChangedRes"]);
		await player.reload();
		expect(player.money).toBe(PLAYER_MONEY);
		const missionsInfo = await PlayerMissionsInfo.findOne({ where: { playerId: player.id } });
		expect(missionsInfo?.gems).toBe(PLAYER_GEMS);
		const epicSlot = await getWeaponSlot(player.id, 0);
		expect(epicSlot?.itemId).toBe(EPIC_WEAPON_ID);
		expect(epicSlot?.itemLevel).toBe(previousLevel);
	});

	it("refuses to enchant the equipment that was swapped into the chest", async () => {
		const player = await setupPlayer({
			equippedWeapon: SABRE_ID,
			chestWeapon: EPIC_WEAPON_ID,
			itemLevel: 0
		});
		const enchantment = ItemEnchantment.PVP_ATTACK_1;
		const openingData = {
			enchanter: await cityService.buildEnchanterData({
				inventory: await inventorySlots.InventorySlots.getOfPlayer(player.id),
				player
			}, {
				enchantment,
				enchantmentId: enchantment.id,
				isPlayerMage: false
			})
		} as unknown as ReactionCollectorCityData;
		expect(openingData.enchanter!.enchantableItems.map(item => item.slot)).toEqual([0]);

		await runChestAction(HomeConstants.CHEST_ACTIONS.SWAP, 0);
		const response: CrowniclesPacket[] = [];
		await enchanterService.handleEnchantReaction(player, {
			slot: 0,
			itemCategory: ItemCategory.WEAPON
		}, openingData, response);

		expect(packetNames(response)).toEqual(["CommandReportEquipmentChangedRes"]);
		await player.reload();
		expect(player.money).toBe(PLAYER_MONEY);
		const epicSlot = await getWeaponSlot(player.id, 0);
		expect(epicSlot?.itemId).toBe(EPIC_WEAPON_ID);
		expect(epicSlot?.itemEnchantmentId).toBeNull();
	});
});
