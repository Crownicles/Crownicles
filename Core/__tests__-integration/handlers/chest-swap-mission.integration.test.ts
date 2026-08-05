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
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { CommandReportHomeChestActionReq } from "../../../Lib/src/packets/commands/CommandReportPacket";

type ReportCityChestServiceModule = typeof import("../../src/core/report/ReportCityChestService");

const KEYCLOAK_ID = "chest-swap-mission";
const INVENTORY_WEAPON_ID = 1;
const CHEST_WEAPON_ID = 2;
const CHEST_SLOT = 1;
const MISSION_OBJECTIVE = 100;
const ONE_HOUR = 3_600_000;
const HOME_LEVEL_WITH_CHEST = 8;

/**
 * Functional regression test for issue #4589.
 *
 * Swapping an inventory item with a chest item does place an item in the chest,
 * so it must progress the "deposit an item in the chest" campaign mission. It
 * used to be ignored, forcing players with a full inventory and a full chest to
 * sell an item before they could complete the mission.
 */
describe("Chest deposit mission (issue #4589)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let HomeChestSlot: ModelStatic<HomeChestSlotType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let chestService: ReportCityChestServiceModule;

	async function setupPlayerWithSwappableItems(): Promise<PlayerType> {
		const player = await Player.create({ keycloakId: KEYCLOAK_ID });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "chest-swap-city",
			level: HOME_LEVEL_WITH_CHEST
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "depositChestItem",
			missionVariant: 0,
			missionObjective: MISSION_OBJECTIVE,
			numberDone: 0,
			expiresAt: new Date(Date.now() + ONE_HOUR),
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});
		await InventorySlot.create({
			playerId: player.id,
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			itemId: INVENTORY_WEAPON_ID,
			itemLevel: 0,
			itemEnchantmentId: null
		});
		await HomeChestSlot.create({
			homeId: home.id,
			slot: CHEST_SLOT,
			itemCategory: ItemCategory.WEAPON,
			itemId: CHEST_WEAPON_ID,
			itemLevel: 0,
			itemEnchantmentId: null
		});
		return player;
	}

	async function getMissionProgress(playerId: number): Promise<number | undefined> {
		const slot = await MissionSlot.findOne({
			where: {
				playerId,
				missionId: "depositChestItem"
			}
		});
		return slot?.numberDone;
	}

	beforeAll(async () => {
		env = await setupCoreForTests("chestswapmission");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Home = env.crownicles.gameDatabase.sequelize.models.Home as ModelStatic<HomeType>;
		HomeChestSlot = env.crownicles.gameDatabase.sequelize.models.HomeChestSlot as ModelStatic<HomeChestSlotType>;
		InventorySlot = env.crownicles.gameDatabase.sequelize.models.InventorySlot as ModelStatic<InventorySlotType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		chestService = loadProductionModule<ReportCityChestServiceModule>("core/report/ReportCityChestService");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await HomeChestSlot.destroy({ truncate: true, force: true });
			await InventorySlot.destroy({ truncate: true, force: true });
			await MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Home.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("progresses the deposit mission when swapping an inventory item with a chest item", async () => {
		const player = await setupPlayerWithSwappableItems();
		const swapPacket: CommandReportHomeChestActionReq = {
			action: HomeConstants.CHEST_ACTIONS.SWAP,
			slot: 0,
			itemCategory: ItemCategory.WEAPON,
			chestSlot: CHEST_SLOT
		};

		const result = await chestService.handleChestAction(KEYCLOAK_ID, swapPacket, []);

		expect(result.success).toBe(true);
		await expect(getMissionProgress(player.id)).resolves.toBe(1);
	});

	it("leaves the deposit mission untouched when withdrawing an item", async () => {
		const player = await setupPlayerWithSwappableItems();
		await InventorySlot.update({ itemId: 0 }, {
			where: {
				playerId: player.id,
				slot: 0
			}
		});
		const withdrawPacket: CommandReportHomeChestActionReq = {
			action: HomeConstants.CHEST_ACTIONS.WITHDRAW,
			slot: CHEST_SLOT,
			itemCategory: ItemCategory.WEAPON,
			chestSlot: -1
		};

		const result = await chestService.handleChestAction(KEYCLOAK_ID, withdrawPacket, []);

		expect(result.success).toBe(true);
		await expect(getMissionProgress(player.id)).resolves.toBe(0);
	});
});
