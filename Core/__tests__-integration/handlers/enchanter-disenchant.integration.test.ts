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
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";

type CityServiceModule = typeof import("../../src/core/report/ReportCityService");
type EnchanterServiceModule = typeof import("../../src/core/report/ReportCityEnchanterService");
type InventorySlotModule = typeof import("../../src/core/database/game/models/InventorySlot");

const KEYCLOAK_ID = "enchanter-disenchant";
const PLAYER_MONEY = 1_000;
const PLAYER_GEMS = 10;
const RESERVE_SLOT = 1;
const CONCURRENT_REQUESTS = 5;

const SABRE_ID = 2;
const SWORD_ID = 9;

const ENCHANTMENT_OF_THE_DAY = ItemEnchantment.PVP_ATTACK_1;
const EQUIPPED_ENCHANTMENT = ItemEnchantment.PVE_ATTACK_1;
const RESERVE_ENCHANTMENT = ItemEnchantment.ALL_ATTACK_1;

/**
 * Issue #4960: the enchanter removes enchantments for free
 */
describe("Enchanter free disenchant (issue #4960)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let cityService: CityServiceModule;
	let enchanterService: EnchanterServiceModule;
	let inventorySlots: InventorySlotModule;

	async function setupPlayer(): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId: KEYCLOAK_ID,
			money: PLAYER_MONEY
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
			itemId: SABRE_ID,
			itemLevel: 0,
			itemEnchantmentId: EQUIPPED_ENCHANTMENT.id
		});
		await InventorySlot.create({
			playerId: player.id,
			slot: RESERVE_SLOT,
			itemCategory: ItemCategory.WEAPON,
			itemId: SWORD_ID,
			itemLevel: 0,
			itemEnchantmentId: RESERVE_ENCHANTMENT.id
		});
		return player;
	}

	async function buildOpeningData(player: PlayerType): Promise<ReactionCollectorCityData> {
		return {
			enchanter: await cityService.buildEnchanterData({
				inventory: await inventorySlots.InventorySlots.getOfPlayer(player.id),
				player
			}, {
				enchantment: ENCHANTMENT_OF_THE_DAY,
				enchantmentId: ENCHANTMENT_OF_THE_DAY.id,
				isPlayerMage: false
			})
		} as unknown as ReactionCollectorCityData;
	}

	async function disenchant(player: PlayerType, slot: number, openingData: ReactionCollectorCityData): Promise<string[]> {
		const response: CrowniclesPacket[] = [];
		await enchanterService.handleEnchanterDisenchantReaction(player, {
			slot,
			itemCategory: ItemCategory.WEAPON
		}, openingData, response);
		return response.map(packet => packet.constructor.name);
	}

	async function getWeaponEnchantment(playerId: number, slot: number): Promise<string | null | undefined> {
		const inventorySlot = await InventorySlot.findOne({
			where: {
				playerId,
				slot,
				itemCategory: ItemCategory.WEAPON
			}
		});
		return inventorySlot?.itemEnchantmentId;
	}

	async function expectCurrenciesUntouched(player: PlayerType): Promise<void> {
		await player.reload();
		expect(player.money).toBe(PLAYER_MONEY);
		const missionsInfo = await PlayerMissionsInfo.findOne({ where: { playerId: player.id } });
		expect(missionsInfo?.gems).toBe(PLAYER_GEMS);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("enchanterdisenchant");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		InventorySlot = models.InventorySlot as ModelStatic<InventorySlotType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		PlayerMissionsInfo = models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		cityService = loadProductionModule<CityServiceModule>("core/report/ReportCityService");
		enchanterService = loadProductionModule<EnchanterServiceModule>("core/report/ReportCityEnchanterService");
		inventorySlots = loadProductionModule<InventorySlotModule>("core/database/game/models/InventorySlot");
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

	it("lists every enchanted weapon, equipped or in reserve", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		expect(openingData.enchanter!.disenchantableItems.map(item => [item.slot, item.enchantmentId])).toEqual([
			[0, EQUIPPED_ENCHANTMENT.id],
			[RESERVE_SLOT, RESERVE_ENCHANTMENT.id]
		]);
	});

	it("removes the enchantment of a reserve weapon without charging anything", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		expect(await disenchant(player, RESERVE_SLOT, openingData)).toEqual(["CommandReportEnchanterDisenchantRes"]);

		expect(await getWeaponEnchantment(player.id, RESERVE_SLOT)).toBeNull();
		expect(await getWeaponEnchantment(player.id, 0)).toBe(EQUIPPED_ENCHANTMENT.id);
		await expectCurrenciesUntouched(player);
	});

	it("refuses to disenchant a weapon whose enchantment changed since the menu was opened", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);
		await InventorySlot.update({ itemEnchantmentId: ENCHANTMENT_OF_THE_DAY.id }, {
			where: {
				playerId: player.id,
				slot: 0,
				itemCategory: ItemCategory.WEAPON
			}
		});

		expect(await disenchant(player, 0, openingData)).toEqual(["CommandReportEquipmentChangedRes"]);

		expect(await getWeaponEnchantment(player.id, 0)).toBe(ENCHANTMENT_OF_THE_DAY.id);
	});

	it("disenchants exactly once under concurrent confirmations", async () => {
		const player = await setupPlayer();
		const openingData = await buildOpeningData(player);

		const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => disenchant(player, 0, openingData)));

		expect(results.filter(packets => packets.includes("CommandReportEnchanterDisenchantRes"))).toHaveLength(1);
		expect(results.filter(packets => packets.includes("CommandReportEquipmentChangedRes"))).toHaveLength(CONCURRENT_REQUESTS - 1);
		expect(await getWeaponEnchantment(player.id, 0)).toBeNull();
		await expectCurrenciesUntouched(player);
	});
});
