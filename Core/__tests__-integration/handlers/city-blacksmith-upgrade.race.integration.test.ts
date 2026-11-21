import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type InventoryInfoType from "../../src/core/database/game/models/InventoryInfo";
import type { Material as MaterialType } from "../../src/core/database/game/models/Material";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { RoyalBlacksmithConstants } from "../../../Lib/src/constants/BlacksmithConstants";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CommandReportBlacksmithUpgradeRes,
	CommandReportRoyalBlacksmithUpgradeRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";

type CityServiceModule = typeof import("../../src/core/report/ReportCityService");
type RoyalServiceModule = typeof import("../../src/core/report/ReportCityRoyalBlacksmithService");
type BlacksmithDataModule = typeof import("../../src/core/report/ReportBlacksmithService");
type RoyalDataModule = typeof import("../../src/core/report/ReportRoyalBlacksmithService");
type InventorySlotModule = typeof import("../../src/core/database/game/models/InventorySlot");

type BlacksmithItem = NonNullable<ReactionCollectorCityData["blacksmith"]>["upgradeableItems"][number];
type RoyalItem = NonNullable<ReactionCollectorCityData["royalBlacksmith"]>["upgradeableItems"][number];

const KEYCLOAK_ID = "city-blacksmith-upgrade";
const CONCURRENT_REQUESTS = 5;
const PLAYER_MONEY = 1_000_000;
const PLAYER_GEMS = 50;
const UPGRADED_SLOT = 0;
const RARE_WEAPON_ID = 11;
const MATERIALS_SURPLUS = 3;

/**
 * Economic invariants of the city blacksmith and royal blacksmith upgrades (review checklist section 11):
 * the menu total is the amount debited, materials are consumed once, and a confirmation sent several times is
 * applied exactly once
 */
describe("City blacksmith upgrades", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let Material: ModelStatic<MaterialType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let cityService: CityServiceModule;
	let royalService: RoyalServiceModule;
	let blacksmithData: BlacksmithDataModule;
	let royalData: RoyalDataModule;
	let inventorySlots: InventorySlotModule;

	async function setupPlayer(itemLevel: number, level = 1): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			money: PLAYER_MONEY,
			level
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			gems: PLAYER_GEMS
		});
		await InventoryInfo.create({ playerId: player.id });
		for (const itemCategory of [ItemCategory.WEAPON, ItemCategory.ARMOR, ItemCategory.POTION, ItemCategory.OBJECT]) {
			await InventorySlot.create({
				playerId: player.id,
				slot: UPGRADED_SLOT,
				itemCategory,
				itemId: itemCategory === ItemCategory.WEAPON ? RARE_WEAPON_ID : 0,
				itemLevel: itemCategory === ItemCategory.WEAPON ? itemLevel : 0,
				itemEnchantmentId: null
			});
		}
		return player;
	}

	async function getMaterialMap(playerId: number): Promise<Map<number, number>> {
		const materials = await Material.findAll({ where: { playerId } });
		return new Map(materials.map(material => [material.materialId, material.quantity]));
	}

	async function giveMaterials(playerId: number, materials: {
		materialId: number; quantity: number;
	}[]): Promise<void> {
		for (const material of materials) {
			if (material.quantity > 0) {
				await Material.create({
					playerId, ...material
				});
			}
		}
	}

	async function openBlacksmith(player: PlayerType): Promise<BlacksmithItem> {
		const data = blacksmithData.buildBlacksmithData(
			await inventorySlots.InventorySlots.getOfPlayer(player.id),
			await getMaterialMap(player.id),
			player
		);
		const [item] = data.upgradeableItems.filter(listed => listed.category === ItemCategory.WEAPON);
		return item;
	}

	async function openRoyalBlacksmith(player: PlayerType): Promise<NonNullable<ReactionCollectorCityData["royalBlacksmith"]>> {
		return await royalData.buildRoyalBlacksmithData(
			await inventorySlots.InventorySlots.getOfPlayer(player.id),
			await getMaterialMap(player.id),
			player
		);
	}

	async function upgradeAtBlacksmith(player: PlayerType, item: BlacksmithItem, buyMaterials: boolean): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];

		// The handler only reads the blacksmith part of the city data
		const data = {
			blacksmith: {
				upgradeableItems: [item], enchantmentTransfers: [], playerMoney: player.money
			}
		} as unknown as ReactionCollectorCityData;
		await cityService.handleBlacksmithUpgradeReaction(player, {
			slot: item.slot, itemCategory: item.category, buyMaterials
		}, data, response);
		return response;
	}

	async function upgradeAtRoyalBlacksmith(player: PlayerType, royal: NonNullable<ReactionCollectorCityData["royalBlacksmith"]>, buyMaterials: boolean): Promise<CrowniclesPacket[]> {
		const [item] = royal.upgradeableItems;
		const response: CrowniclesPacket[] = [];

		// The handler only reads the royal blacksmith part of the city data
		const data = { royalBlacksmith: royal } as unknown as ReactionCollectorCityData;
		await royalService.handleRoyalBlacksmithUpgradeReaction(player, {
			slot: item.slot, itemCategory: item.category, buyMaterials
		}, data, response);
		return response;
	}

	async function getWeaponLevel(playerId: number): Promise<number | undefined> {
		return (await InventorySlot.findOne({
			where: {
				playerId, slot: UPGRADED_SLOT, itemCategory: ItemCategory.WEAPON
			}
		}))?.itemLevel;
	}

	async function getMoney(playerId: number): Promise<number> {
		return (await Player.findByPk(playerId, { rejectOnEmpty: true })).money;
	}

	async function getGems(playerId: number): Promise<number> {
		return (await PlayerMissionsInfo.findByPk(playerId, { rejectOnEmpty: true })).gems;
	}

	function requiredMaterialsOf(item: BlacksmithItem | RoyalItem, extra: number): {
		materialId: number; quantity: number;
	}[] {
		return item.requiredMaterials.map(material => ({
			materialId: material.materialId, quantity: material.quantity + extra
		}));
	}

	/**
	 * The handlers run from the compiled `dist/` tree: their packets are instances of other classes than the ones
	 * imported here, so they are matched by class name
	 */
	function packetsOf<T extends CrowniclesPacket>(responses: CrowniclesPacket[][], packetClass: new () => T): T[] {
		return responses.flat().filter((packet): packet is T => packet.constructor.name === packetClass.name);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("cityblacksmithupgrade");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		InventorySlot = models.InventorySlot as ModelStatic<InventorySlotType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		Material = models.Material as ModelStatic<MaterialType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		cityService = loadProductionModule<CityServiceModule>("core/report/ReportCityService");
		royalService = loadProductionModule<RoyalServiceModule>("core/report/ReportCityRoyalBlacksmithService");
		blacksmithData = loadProductionModule<BlacksmithDataModule>("core/report/ReportBlacksmithService");
		royalData = loadProductionModule<RoyalDataModule>("core/report/ReportRoyalBlacksmithService");
		inventorySlots = loadProductionModule<InventorySlotModule>("core/database/game/models/InventorySlot");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const model of [Material, InventorySlot, InventoryInfo, PlayerMissionsInfo, Player, sequelize.models.MissionSlot]) {
				await (model as ModelStatic<PlayerType>).destroy({
					truncate: true, force: true
				});
			}
		}
		finally {
			await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	describe("blacksmith", () => {
		it("consumes the required materials and debits the listed upgrade cost when the player owns every material", async () => {
			const player = await setupPlayer(0);
			const listed = await openBlacksmith(player);
			await giveMaterials(player.id, requiredMaterialsOf(listed, MATERIALS_SURPLUS));
			const item = await openBlacksmith(player);
			expect(item.hasAllMaterials).toBe(true);

			const response = await upgradeAtBlacksmith(player, item, false);

			expect(packetsOf([response], CommandReportBlacksmithUpgradeRes).map(packet => [packet.totalCost, packet.newItemLevel, packet.boughtMaterials]))
				.toEqual([[item.upgradeCost, 1, false]]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - item.upgradeCost);
			expect(await getWeaponLevel(player.id)).toBe(1);
			expect(Object.fromEntries(await getMaterialMap(player.id))).toEqual(Object.fromEntries(item.requiredMaterials.map(material => [material.materialId, MATERIALS_SURPLUS])));
		});

		it("debits the upgrade cost plus the missing materials cost shown by the menu and consumes the owned part only", async () => {
			const player = await setupPlayer(0);
			const listed = await openBlacksmith(player);
			const [partial] = listed.requiredMaterials;
			await giveMaterials(player.id, [{
				materialId: partial.materialId, quantity: partial.quantity - 1
			}]);
			const item = await openBlacksmith(player);
			expect(item.hasAllMaterials).toBe(false);
			expect(item.missingMaterialsCost).toBeGreaterThan(0);

			const response = await upgradeAtBlacksmith(player, item, true);

			const shownTotal = item.upgradeCost + item.missingMaterialsCost;
			expect(packetsOf([response], CommandReportBlacksmithUpgradeRes).map(packet => [packet.totalCost, packet.boughtMaterials]))
				.toEqual([[shownTotal, true]]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - shownTotal);
			expect(await getWeaponLevel(player.id)).toBe(1);
			expect([...(await getMaterialMap(player.id)).values()].every(quantity => quantity === 0)).toBe(true);
		});

		it("refuses without debiting nor consuming when materials are missing and the player does not buy them", async () => {
			const player = await setupPlayer(0);
			const listed = await openBlacksmith(player);
			const [partial] = listed.requiredMaterials;
			await giveMaterials(player.id, [{
				materialId: partial.materialId, quantity: partial.quantity - 1
			}]);
			const item = await openBlacksmith(player);

			const response = await upgradeAtBlacksmith(player, item, false);

			expect(response.map(packet => packet.constructor.name)).toEqual(["CommandReportBlacksmithMissingMaterialsRes"]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY);
			expect(await getWeaponLevel(player.id)).toBe(0);
			expect((await getMaterialMap(player.id)).get(partial.materialId)).toBe(partial.quantity - 1);
		});

		it("refuses with the exact missing amount when the player cannot pay the upgrade", async () => {
			const player = await setupPlayer(0);
			const listed = await openBlacksmith(player);
			await giveMaterials(player.id, requiredMaterialsOf(listed, 0));
			const item = await openBlacksmith(player);
			const money = item.upgradeCost - 1;
			await Player.update({ money }, { where: { id: player.id } });

			const response = await upgradeAtBlacksmith(player, item, false);

			expect(response.map(packet => [packet.constructor.name, (packet as { missingMoney?: number }).missingMoney]))
				.toEqual([["CommandReportBlacksmithNotEnoughMoneyRes", 1]]);
			expect(await getMoney(player.id)).toBe(money);
			expect(await getWeaponLevel(player.id)).toBe(0);
		});

		it("upgrades, consumes and debits exactly once under concurrent confirmations", async () => {
			const player = await setupPlayer(0);
			const listed = await openBlacksmith(player);
			await giveMaterials(player.id, requiredMaterialsOf(listed, MATERIALS_SURPLUS * CONCURRENT_REQUESTS));
			const item = await openBlacksmith(player);

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, () => upgradeAtBlacksmith(player, item, false)));

			expect(packetsOf(responses, CommandReportBlacksmithUpgradeRes)).toHaveLength(1);
			expect(await getWeaponLevel(player.id)).toBe(1);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - item.upgradeCost);
			const remaining = await getMaterialMap(player.id);
			for (const material of item.requiredMaterials) {
				expect(remaining.get(material.materialId)).toBe(MATERIALS_SURPLUS * CONCURRENT_REQUESTS);
			}
		});
	});

	describe("royal blacksmith", () => {
		it("debits the listed money and gem costs and brings the item to the target level", async () => {
			const player = await setupPlayer(RoyalBlacksmithConstants.TARGET_LEVEL - 1, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
			const listed = await openRoyalBlacksmith(player);
			await giveMaterials(player.id, requiredMaterialsOf(listed.upgradeableItems[0], 0));
			const royal = await openRoyalBlacksmith(player);
			const [item] = royal.upgradeableItems;
			expect(royal.status).toBe("ready");
			expect(item.canUpgrade).toBe(true);

			const response = await upgradeAtRoyalBlacksmith(player, royal, false);

			expect(packetsOf([response], CommandReportRoyalBlacksmithUpgradeRes).map(packet => [packet.upgradeCost, packet.materialsCost, packet.gemCost]))
				.toEqual([[item.upgradeCost, 0, item.gemCost]]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - item.upgradeCost);
			expect(await getGems(player.id)).toBe(PLAYER_GEMS - item.gemCost);
			expect(await getWeaponLevel(player.id)).toBe(RoyalBlacksmithConstants.TARGET_LEVEL);
		});

		it("debits the missing materials cost shown by the menu on top of the upgrade cost", async () => {
			const player = await setupPlayer(RoyalBlacksmithConstants.TARGET_LEVEL - 1, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
			const royal = await openRoyalBlacksmith(player);
			const [item] = royal.upgradeableItems;
			expect(item.canBuyAndUpgrade).toBe(true);

			const response = await upgradeAtRoyalBlacksmith(player, royal, true);

			expect(packetsOf([response], CommandReportRoyalBlacksmithUpgradeRes).map(packet => packet.materialsCost)).toEqual([item.missingMaterialsCost]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - item.upgradeCost - item.missingMaterialsCost);
			expect(await getGems(player.id)).toBe(PLAYER_GEMS - item.gemCost);
		});

		it("refuses without debiting anything when the player lacks gems", async () => {
			const player = await setupPlayer(RoyalBlacksmithConstants.TARGET_LEVEL - 1, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
			const royal = await openRoyalBlacksmith(player);
			const [item] = royal.upgradeableItems;
			await PlayerMissionsInfo.update({ gems: item.gemCost - 1 }, { where: { playerId: player.id } });

			const response = await upgradeAtRoyalBlacksmith(player, royal, true);

			expect(response.map(packet => [packet.constructor.name, (packet as { missingGems?: number }).missingGems]))
				.toEqual([["CommandReportRoyalBlacksmithNotEnoughGemsRes", 1]]);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY);
			expect(await getGems(player.id)).toBe(item.gemCost - 1);
			expect(await getWeaponLevel(player.id)).toBe(RoyalBlacksmithConstants.TARGET_LEVEL - 1);
		});

		it("upgrades and debits money and gems exactly once under concurrent confirmations", async () => {
			const player = await setupPlayer(RoyalBlacksmithConstants.TARGET_LEVEL - 1, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
			const royal = await openRoyalBlacksmith(player);
			const [item] = royal.upgradeableItems;

			const responses = await runAllOrThrow(Array.from({ length: CONCURRENT_REQUESTS }, () => upgradeAtRoyalBlacksmith(player, royal, true)));

			expect(packetsOf(responses, CommandReportRoyalBlacksmithUpgradeRes)).toHaveLength(1);
			expect(await getMoney(player.id)).toBe(PLAYER_MONEY - item.upgradeCost - item.missingMaterialsCost);
			expect(await getGems(player.id)).toBe(PLAYER_GEMS - item.gemCost);
		});
	});
});
