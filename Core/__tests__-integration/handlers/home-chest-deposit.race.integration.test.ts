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
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { CommandReportHomeChestActionReq } from "../../../Lib/src/packets/commands/CommandReportPacket";

type ReportCityChestServiceModule = typeof import("../../src/core/report/ReportCityChestService");

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
	let chestService: ReportCityChestServiceModule;

	beforeAll(async () => {
		env = await setupCoreForTests("homechestdeposit");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Home = env.crownicles.gameDatabase.sequelize.models.Home as ModelStatic<HomeType>;
		HomeChestSlot = env.crownicles.gameDatabase.sequelize.models.HomeChestSlot as ModelStatic<HomeChestSlotType>;
		InventorySlot = env.crownicles.gameDatabase.sequelize.models.InventorySlot as ModelStatic<InventorySlotType>;
		chestService = loadProductionModule<ReportCityChestServiceModule>(
			"core/report/ReportCityChestService"
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
});
