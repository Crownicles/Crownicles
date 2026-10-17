import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { HomeChestSlot as HomeChestSlotType } from "../../src/core/database/game/models/HomeChestSlot";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { CommandReportHomeChestActionReq } from "../../../Lib/src/packets/commands/CommandReportPacket";

type ReportCityChestServiceModule = typeof import("../../src/core/report/ReportCityChestService");
type InventorySlotIntegrityMigrationModule = typeof import("../../src/core/database/game/migrations/067-inventory-slot-integrity");

const N_CONCURRENT = 25;
const KEYCLOAK_ID = "race-home-chest-deposit";
const DEPOSITED_WEAPON_ID = 1;

// Level 8 home exposes 3 empty weapon chest slots, enough that an
// unlocked deposit could scatter the same item across several slots
// (duplication). The lock must keep it to a single copy.
const HOME_LEVEL_WITH_MULTIPLE_CHEST_SLOTS = 8;
const WEAPON_CHEST_SLOTS = 3;

/**
 * Race test for {@link ReportCityChestServiceModule.handleChestAction}.
 * The handler is fired directly from Discord via a packet handler, so it
 * bypasses the per-player command blocking. Fast button mashing can emit
 * several concurrent deposit packets for the same inventory item. Without
 * a row-level lock, each request reads the same active inventory slot and
 * places the item into a *different* empty chest slot, duplicating it.
 * The handler locks `[Player, Home]`, so racing N deposits of the same
 * item must move it EXACTLY once: one filled chest slot, an emptied
 * inventory slot, and exactly one successful response.
 */
describe("ReportCityChestService.handleChestAction deposit race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let HomeChestSlot: ModelStatic<HomeChestSlotType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let chestService: ReportCityChestServiceModule;
	let inventorySlotIntegrityMigration: InventorySlotIntegrityMigrationModule;

	beforeAll(async () => {
		env = await setupCoreForTests("homechestdeposit");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Home = env.crownicles.gameDatabase.sequelize.models.Home as ModelStatic<HomeType>;
		HomeChestSlot = env.crownicles.gameDatabase.sequelize.models.HomeChestSlot as ModelStatic<HomeChestSlotType>;
		InventorySlot = env.crownicles.gameDatabase.sequelize.models.InventorySlot as ModelStatic<InventorySlotType>;
		InventoryInfo = env.crownicles.gameDatabase.sequelize.models.InventoryInfo as ModelStatic<InventoryInfoType>;
		chestService = loadProductionModule<ReportCityChestServiceModule>(
			"core/report/ReportCityChestService"
		);
		inventorySlotIntegrityMigration = loadProductionModule<InventorySlotIntegrityMigrationModule>(
			"core/database/game/migrations/067-inventory-slot-integrity"
		);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await HomeChestSlot.destroy({ truncate: true, force: true });
			await InventorySlot.destroy({ truncate: true, force: true });
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Home.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it(`moves the item exactly once under N=${N_CONCURRENT} concurrent deposits`, async () => {
		const player = await Player.create({ keycloakId: KEYCLOAK_ID });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "race-test-city",
			level: HOME_LEVEL_WITH_MULTIPLE_CHEST_SLOTS
		});

		// Active weapon inventory slot holding the item to deposit.
		await InventorySlot.create({
			playerId: player.id,
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			itemId: DEPOSITED_WEAPON_ID,
			itemLevel: 0,
			itemEnchantmentId: null
		});

		// Pre-create the empty weapon chest slots the deposit will target.
		await HomeChestSlot.bulkCreate(
			Array.from({ length: WEAPON_CHEST_SLOTS }, (_unused, index) => ({
				homeId: home.id,
				slot: index + 1,
				itemCategory: ItemCategory.WEAPON,
				itemId: 0,
				itemLevel: 0,
				itemEnchantmentId: null
			}))
		);

		const depositPacket: CommandReportHomeChestActionReq = {
			action: HomeConstants.CHEST_ACTIONS.DEPOSIT,
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			chestSlot: -1
		};

		const results = await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => chestService.handleChestAction(KEYCLOAK_ID, depositPacket, []))
		);

		// Exactly one deposit may succeed; the others find an empty slot.
		const successCount = results.filter(result => result.success).length;
		expect(successCount).toBe(1);

		// The item left the inventory exactly once.
		const activeInventorySlot = await InventorySlot.findOne({
			where: {
				playerId: player.id,
				slot: 0,
				itemCategory: ItemCategory.WEAPON
			}
		});
		expect(activeInventorySlot!.itemId).toBe(0);

		// No duplication: a single chest slot holds the deposited item.
		const filledChestSlots = await HomeChestSlot.findAll({
			where: {
				homeId: home.id,
				itemCategory: ItemCategory.WEAPON
			}
		});
		const occupied = filledChestSlots.filter(chestSlot => chestSlot.itemId !== 0);
		expect(occupied).toHaveLength(1);
		expect(occupied[0].itemId).toBe(DEPOSITED_WEAPON_ID);
	});

	it("reuses the first missing reserve slot when withdrawing from the chest", async () => {
		const player = await Player.create({ keycloakId: `${KEYCLOAK_ID}-gap` });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "gap-test-city",
			level: HOME_LEVEL_WITH_MULTIPLE_CHEST_SLOTS
		});
		await InventoryInfo.create({
			playerId: player.id,
			weaponSlots: 1,
			armorSlots: 1,
			potionSlots: 1,
			objectSlots: 2,
			plantSlots: 1
		});
		await InventorySlot.bulkCreate([
			{
				playerId: player.id,
				slot: 0,
				itemCategory: ItemCategory.OBJECT,
				itemId: 1,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null
			},
			{
				playerId: player.id,
				slot: 2,
				itemCategory: ItemCategory.OBJECT,
				itemId: 2,
				itemLevel: 0,
				itemEnchantmentId: null,
				remainingPotionUsages: null
			}
		]);
		await HomeChestSlot.create({
			homeId: home.id,
			slot: 1,
			itemCategory: ItemCategory.OBJECT,
			itemId: 3,
			itemLevel: 0,
			itemEnchantmentId: null,
			remainingPotionUsages: null
		});

		const result = await chestService.handleChestAction(player.keycloakId, {
			action: HomeConstants.CHEST_ACTIONS.WITHDRAW,
			slot: 1,
			itemCategory: ItemCategory.OBJECT,
			chestSlot: -1
		}, []);

		expect(result.success).toBe(true);
		const reserveSlots = await InventorySlot.findAll({
			where: {
				playerId: player.id,
				itemCategory: ItemCategory.OBJECT
			},
			order: [["slot", "ASC"]]
		});
		expect(reserveSlots.map(slot => [slot.slot, slot.itemId])).toEqual([
			[0, 1],
			[1, 3],
			[2, 2]
		]);
	});

	it("preserves potion usages through a chest deposit and withdrawal", async () => {
		const player = await Player.create({ keycloakId: `${KEYCLOAK_ID}-potion` });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "potion-test-city",
			level: HOME_LEVEL_WITH_MULTIPLE_CHEST_SLOTS
		});
		await InventorySlot.create({
			playerId: player.id,
			slot: 0,
			itemCategory: ItemCategory.POTION,
			itemId: 12,
			itemLevel: 0,
			itemEnchantmentId: null,
			remainingPotionUsages: 1
		});
		await HomeChestSlot.create({
			homeId: home.id,
			slot: 1,
			itemCategory: ItemCategory.POTION,
			itemId: 0,
			itemLevel: 0,
			itemEnchantmentId: null,
			remainingPotionUsages: null
		});

		const depositResult = await chestService.handleChestAction(player.keycloakId, {
			action: HomeConstants.CHEST_ACTIONS.DEPOSIT,
			slot: 0,
			itemCategory: ItemCategory.POTION,
			chestSlot: -1
		}, []);
		expect(depositResult.success).toBe(true);
		await expect(HomeChestSlot.findOne({
			where: {
				homeId: home.id,
				slot: 1,
				itemCategory: ItemCategory.POTION
			}
		})).resolves.toMatchObject({
			itemId: 12,
			remainingPotionUsages: 1
		});

		const withdrawResult = await chestService.handleChestAction(player.keycloakId, {
			action: HomeConstants.CHEST_ACTIONS.WITHDRAW,
			slot: 1,
			itemCategory: ItemCategory.POTION,
			chestSlot: -1
		}, []);
		expect(withdrawResult.success).toBe(true);
		await expect(InventorySlot.findOne({
			where: {
				playerId: player.id,
				slot: 0,
				itemCategory: ItemCategory.POTION
			}
		})).resolves.toMatchObject({
			itemId: 12,
			remainingPotionUsages: 1
		});
	});

	it("compacts existing reserve gaps without losing item attributes", async () => {
		const player = await Player.create({ keycloakId: `${KEYCLOAK_ID}-migration` });
		await InventorySlot.bulkCreate([
			{
				playerId: player.id,
				slot: 0,
				itemCategory: ItemCategory.WEAPON,
				itemId: 1,
				itemLevel: 0,
				itemEnchantmentId: null
			},
			{
				playerId: player.id,
				slot: 2,
				itemCategory: ItemCategory.WEAPON,
				itemId: 0,
				itemLevel: 0,
				itemEnchantmentId: null
			},
			{
				playerId: player.id,
				slot: 3,
				itemCategory: ItemCategory.WEAPON,
				itemId: 2,
				itemLevel: 4,
				itemEnchantmentId: "allAttack1"
			},
			{
				playerId: player.id,
				slot: 5,
				itemCategory: ItemCategory.WEAPON,
				itemId: 3,
				itemLevel: 2,
				itemEnchantmentId: null
			}
		]);

		await inventorySlotIntegrityMigration.compactInventorySlots(
			env.crownicles.gameDatabase.sequelize.getQueryInterface()
		);

		const slots = await InventorySlot.findAll({
			where: {
				playerId: player.id,
				itemCategory: ItemCategory.WEAPON
			},
			order: [["slot", "ASC"]]
		});
		expect(slots.map(slot => ({
			slot: slot.slot,
			itemId: slot.itemId,
			itemLevel: slot.itemLevel,
			itemEnchantmentId: slot.itemEnchantmentId
		}))).toEqual([
			{
				slot: 0, itemId: 1, itemLevel: 0, itemEnchantmentId: null
			},
			{
				slot: 1, itemId: 2, itemLevel: 4, itemEnchantmentId: "allAttack1"
			},
			{
				slot: 2, itemId: 3, itemLevel: 2, itemEnchantmentId: null
			}
		]);
	});
});
