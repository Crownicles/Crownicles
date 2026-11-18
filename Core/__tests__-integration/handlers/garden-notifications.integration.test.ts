import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import type { PlayerPlantSlot as PlayerPlantSlotType } from "../../src/core/database/game/models/PlayerPlantSlot";
import type { HomeGardenSlot as HomeGardenSlotType } from "../../src/core/database/game/models/HomeGardenSlot";
import type { ScheduledGardenNotification as ScheduledGardenNotificationType } from "../../src/core/database/game/models/ScheduledGardenNotification";
import {
	PLANT_SLOT_TYPE, PlantConstants, PlantId
} from "../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../Lib/src/constants/GardenConstants";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import type {
	CommandReportGardenHarvestReq, CommandReportGardenPlantReq
} from "../../../Lib/src/packets/commands/CommandReportPacket";

type ReportGardenServiceModule = typeof import("../../src/core/report/ReportGardenService");

const FIND_EMPTY_SLOT = -1;
const MS_PER_SECOND = 1000;

function getSmallestGardenHomeLevel(): HomeLevel {
	let level = HomeLevel.getInitialLevel().level;
	while (HomeLevel.getByLevel(level)!.features.gardenPlots < 2) {
		level++;
	}
	return HomeLevel.getByLevel(level)!;
}

const GARDEN_HOME_LEVEL = getSmallestGardenHomeLevel();

/**
 * The garden notifications are rescheduled from the persisted garden after each growth change:
 * the "plant ready" one at the next plant to finish growing, the "all plants ready" one at the last.
 */
describe("Garden notifications scheduling", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let PlayerPlantSlot: ModelStatic<PlayerPlantSlotType>;
	let HomeGardenSlot: ModelStatic<HomeGardenSlotType>;
	let ScheduledGardenNotification: ModelStatic<ScheduledGardenNotificationType>;
	let gardenService: ReportGardenServiceModule;

	beforeAll(async () => {
		env = await setupCoreForTests("gardennotifications");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		InventoryInfo = models.InventoryInfo as ModelStatic<InventoryInfoType>;
		PlayerPlantSlot = models.PlayerPlantSlot as ModelStatic<PlayerPlantSlotType>;
		HomeGardenSlot = models.HomeGardenSlot as ModelStatic<HomeGardenSlotType>;
		ScheduledGardenNotification = models.ScheduledGardenNotification as ModelStatic<ScheduledGardenNotificationType>;
		gardenService = loadProductionModule<ReportGardenServiceModule>("core/report/ReportGardenService");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			for (const table of ["player_plant_slots", "home_garden_slots", "home_plant_storage", "scheduled_garden_notifications"]) {
				await sequelize.query(`TRUNCATE TABLE ${table}`);
			}
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Home.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function createGardenOwner(): Promise<{ player: PlayerType; home: HomeType }> {
		const player = await Player.create({ keycloakId: "garden-notifications" });
		await InventoryInfo.create({ playerId: player.id });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "garden-notifications-city",
			level: GARDEN_HOME_LEVEL.level
		});
		await HomeGardenSlot.bulkCreate(Array.from({ length: GARDEN_HOME_LEVEL.features.gardenPlots }, (_unused, slot) => ({
			homeId: home.id,
			slot,
			plantId: 0,
			plantedAt: null
		})));
		return {
			player, home
		};
	}

	async function plant(player: PlayerType, plantId: PlantId): Promise<void> {
		await PlayerPlantSlot.destroy({
			where: {
				playerId: player.id, slotType: PLANT_SLOT_TYPE.SEED
			}
		});
		await PlayerPlantSlot.create({
			playerId: player.id,
			slotType: PLANT_SLOT_TYPE.SEED,
			slot: 0,
			plantId
		});
		const response: CrowniclesPacket[] = [];
		await gardenService.handleGardenPlant(player.keycloakId, { gardenSlot: FIND_EMPTY_SLOT } as CommandReportGardenPlantReq, response);
	}

	async function getPersistedReadyTimes(homeId: number): Promise<number[]> {
		const slots = await HomeGardenSlot.findAll({ where: { homeId } });
		return slots
			.filter(slot => slot.plantId !== 0)
			.map(slot => {
				const growthSeconds = GardenConstants.getEffectiveGrowthTime(
					PlantConstants.getPlantById(slot.plantId)!.growthTimeSeconds,
					GARDEN_HOME_LEVEL.features.gardenEarthQuality
				);
				return Math.floor((slot.plantedAt!.valueOf() + growthSeconds * MS_PER_SECOND) / MS_PER_SECOND) * MS_PER_SECOND;
			});
	}

	async function getScheduledAt(playerId: number, type: string): Promise<number | undefined> {
		const notification = await ScheduledGardenNotification.findOne({
			where: {
				playerId, type
			}
		});
		return notification?.scheduledAt.valueOf();
	}

	it("schedules the first and the last plant to grow after planting", async () => {
		const {
			player, home
		} = await createGardenOwner();

		await plant(player, PlantId.COMMON_HERB);
		await plant(player, PlantId.LUNAR_MOSS);

		const readyTimes = await getPersistedReadyTimes(home.id);
		expect(readyTimes).toHaveLength(2);
		expect(await getScheduledAt(player.id, "plantReady")).toBe(Math.min(...readyTimes));
		expect(await getScheduledAt(player.id, "allPlantsReady")).toBe(Math.max(...readyTimes));
	});

	it("reschedules from the restarted growth after a harvest", async () => {
		const {
			player, home
		} = await createGardenOwner();
		await plant(player, PlantId.COMMON_HERB);
		await plant(player, PlantId.LUNAR_MOSS);

		// Both plants become ready, then the player harvests them: both growths restart
		await HomeGardenSlot.update({ plantedAt: new Date(Date.now() - 365 * 24 * 3600 * MS_PER_SECOND) }, { where: { homeId: home.id } });
		const response: CrowniclesPacket[] = [];
		await gardenService.handleGardenHarvest(player.keycloakId, {} as CommandReportGardenHarvestReq, response);

		const readyTimes = await getPersistedReadyTimes(home.id);
		expect(Math.min(...readyTimes)).toBeGreaterThan(Date.now() - MS_PER_SECOND);
		expect(await getScheduledAt(player.id, "plantReady")).toBe(Math.min(...readyTimes));
		expect(await getScheduledAt(player.id, "allPlantsReady")).toBe(Math.max(...readyTimes));
	});
});
