import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type InventoryInfoType from "../../src/core/database/game/models/InventoryInfo";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import {
	ItemCategory, ItemRarity
} from "../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { BlacksmithConstants } from "../../../Lib/src/constants/BlacksmithConstants";

type CityServiceModule = typeof import("../../src/core/report/ReportCityService");
type InventorySlotModule = typeof import("../../src/core/database/game/models/InventorySlot");
type BlacksmithDataModule = typeof import("../../src/core/report/ReportBlacksmithService");

const KEYCLOAK_ID = "blacksmith-enchantment-transfer";
const PLAYER_MONEY = 1_000;
const CONCURRENT_REQUESTS = 5;

const EQUIPPED_SLOT = 0;
const TARGET_SLOT = 1;
const OTHER_SOURCE_SLOT = 2;

const COMMON_SABRE_ID = 2;
const RARE_WEAPON_ID = 11;
const COMMON_SWORD_ID = 9;
const COMMON_ARMOR_ID = 2;

const EQUIPPED_ENCHANTMENT = ItemEnchantment.PVE_ATTACK_1;
const OTHER_ENCHANTMENT = ItemEnchantment.ALL_ATTACK_1;
const RARE_TARGET_PRICE = BlacksmithConstants.ENCHANTMENT_TRANSFER_PRICE[ItemRarity.RARE];

/**
 * The blacksmith moves an enchantment from one equipment onto another unenchanted equipment of the same category
 */
describe("Blacksmith enchantment transfer", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let cityService: CityServiceModule;
	let inventorySlots: InventorySlotModule;
	let blacksmithData: BlacksmithDataModule;

	async function createSlot(playerId: number, slot: {
		slot: number;
		itemCategory: ItemCategory;
		itemId: number;
		itemEnchantmentId: string | null;
	}): Promise<void> {
		await InventorySlot.create({
			playerId,
			itemLevel: 0,
			...slot
		});
	}

	async function setupPlayer(): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			money: PLAYER_MONEY
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await InventoryInfo.create({
			playerId: player.id,
			weaponSlots: OTHER_SOURCE_SLOT + 1
		});
		await createSlot(player.id, {
			slot: EQUIPPED_SLOT, itemCategory: ItemCategory.WEAPON, itemId: COMMON_SABRE_ID, itemEnchantmentId: EQUIPPED_ENCHANTMENT.id
		});
		await createSlot(player.id, {
			slot: TARGET_SLOT, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID, itemEnchantmentId: null
		});
		await createSlot(player.id, {
			slot: OTHER_SOURCE_SLOT, itemCategory: ItemCategory.WEAPON, itemId: COMMON_SWORD_ID, itemEnchantmentId: OTHER_ENCHANTMENT.id
		});
		await createSlot(player.id, {
			slot: EQUIPPED_SLOT, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID, itemEnchantmentId: null
		});
		return player;
	}

	async function buildOpeningData(player: PlayerType): Promise<ReactionCollectorCityData> {
		return {
			blacksmith: blacksmithData.buildBlacksmithData(await inventorySlots.InventorySlots.getOfPlayer(player.id), new Map(), player)
		} as unknown as ReactionCollectorCityData;
	}

	async function transfer(player: PlayerType, sourceSlot: number, openingData: ReactionCollectorCityData): Promise<string[]> {
		const response: CrowniclesPacket[] = [];
		await cityService.handleBlacksmithEnchantmentTransferReaction(player, {
			itemCategory: ItemCategory.WEAPON,
			sourceSlot,
			targetSlot: TARGET_SLOT
		}, openingData, response);
		return response.map(packet => packet.constructor.name);
	}

	async function getWeaponEnchantments(playerId: number): Promise<Record<number, string | null>> {
		const slots = await InventorySlot.findAll({
			where: {
				playerId,
				itemCategory: ItemCategory.WEAPON
			}
		});
		return Object.fromEntries(slots.map(slot => [slot.slot, slot.itemEnchantmentId]));
	}

	async function getMoney(player: PlayerType): Promise<number> {
		await player.reload();
		return player.money;
	}

	beforeAll(async () => {
		env = await setupCoreForTests("blacksmithenchanttransfer");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		InventorySlot = models.InventorySlot as ModelStatic<InventorySlotType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		cityService = loadProductionModule<CityServiceModule>("core/report/ReportCityService");
		inventorySlots = loadProductionModule<InventorySlotModule>("core/database/game/models/InventorySlot");
		blacksmithData = loadProductionModule<BlacksmithDataModule>("core/report/ReportBlacksmithService");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const model of [InventorySlot, InventoryInfo, PlayerMissionsInfo, Player]) {
				await (model as ModelStatic<PlayerType>).destroy({
					truncate: true, force: true
				});
			}
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("offers each enchanted weapon the unenchanted weapons only, priced by the rarity of the receiving weapon", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		expect(openingData.blacksmith!.enchantmentTransfers.map(source => ({
			slot: source.slot,
			enchantmentId: source.enchantmentId,
			targets: source.targets.map(target => [target.slot, target.cost, target.canAfford])
		}))).toEqual([
			{
				slot: EQUIPPED_SLOT, enchantmentId: EQUIPPED_ENCHANTMENT.id, targets: [[TARGET_SLOT, RARE_TARGET_PRICE, true]]
			},
			{
				slot: OTHER_SOURCE_SLOT, enchantmentId: OTHER_ENCHANTMENT.id, targets: [[TARGET_SLOT, RARE_TARGET_PRICE, true]]
			}
		]);
	});

	it("moves the enchantment onto the target and charges the listed price", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		expect(await transfer(player, EQUIPPED_SLOT, openingData)).toContain("CommandReportBlacksmithEnchantmentTransferRes");

		expect(await getWeaponEnchantments(player.id)).toEqual({
			[EQUIPPED_SLOT]: null,
			[TARGET_SLOT]: EQUIPPED_ENCHANTMENT.id,
			[OTHER_SOURCE_SLOT]: OTHER_ENCHANTMENT.id
		});
		expect(await getMoney(player)).toBe(PLAYER_MONEY - RARE_TARGET_PRICE);
	});

	it("refuses when the target received an enchantment since the menu was opened", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);
		await InventorySlot.update({ itemEnchantmentId: ItemEnchantment.PVP_ATTACK_1.id }, {
			where: {
				playerId: player.id,
				slot: TARGET_SLOT,
				itemCategory: ItemCategory.WEAPON
			}
		});

		expect(await transfer(player, EQUIPPED_SLOT, openingData)).toEqual(["CommandReportEquipmentChangedRes"]);

		expect(await getWeaponEnchantments(player.id)).toMatchObject({
			[EQUIPPED_SLOT]: EQUIPPED_ENCHANTMENT.id,
			[TARGET_SLOT]: ItemEnchantment.PVP_ATTACK_1.id
		});
		expect(await getMoney(player)).toBe(PLAYER_MONEY);
	});

	it("refuses without moving anything when the player can no longer pay", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);
		await Player.update({ money: RARE_TARGET_PRICE - 1 }, { where: { id: player.id } });

		expect(await transfer(player, EQUIPPED_SLOT, openingData)).toEqual(["CommandReportBlacksmithNotEnoughMoneyRes"]);

		expect((await getWeaponEnchantments(player.id))[EQUIPPED_SLOT]).toBe(EQUIPPED_ENCHANTMENT.id);
		expect(await getMoney(player)).toBe(RARE_TARGET_PRICE - 1);
	});

	it("transfers and charges exactly once under concurrent confirmations", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => transfer(player, EQUIPPED_SLOT, openingData)));

		expect(results.filter(packets => packets.includes("CommandReportBlacksmithEnchantmentTransferRes"))).toHaveLength(1);
		expect(results.filter(packets => packets.includes("CommandReportEquipmentChangedRes"))).toHaveLength(CONCURRENT_REQUESTS - 1);
		expect((await getWeaponEnchantments(player.id))[TARGET_SLOT]).toBe(EQUIPPED_ENCHANTMENT.id);
		expect(await getMoney(player)).toBe(PLAYER_MONEY - RARE_TARGET_PRICE);
	});

	it("never loses nor duplicates an enchantment when two sources race for the same target", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		const results = await Promise.all([
			transfer(player, EQUIPPED_SLOT, openingData),
			transfer(player, OTHER_SOURCE_SLOT, openingData)
		]);

		expect(results.filter(packets => packets.includes("CommandReportBlacksmithEnchantmentTransferRes"))).toHaveLength(1);
		expect(results.filter(packets => packets.includes("CommandReportEquipmentChangedRes"))).toHaveLength(1);
		const remainingEnchantments = Object.values(await getWeaponEnchantments(player.id)).filter(enchantmentId => enchantmentId !== null);
		expect(remainingEnchantments.sort()).toEqual([EQUIPPED_ENCHANTMENT.id, OTHER_ENCHANTMENT.id].sort());
		expect(await getMoney(player)).toBe(PLAYER_MONEY - RARE_TARGET_PRICE);
	});
});
