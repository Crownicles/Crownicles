import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const logGardenAction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logGardenAction } }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({ updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/core/bot/GardenNotifications", () => ({ rescheduleGardenNotificationsUnderLock: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/core/quests/Quests", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/quests/Quests")>(),
	notifyQuestStepCompleted: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn()
}));

import {
	buildGardenData, handleGardenCompostReaction, handleGardenHarvest, handleGardenPlant, handleGardenWater, handlePlantTransfer
} from "../../../src/core/report/ReportGardenService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import HomeGardenSlot, { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";
import {
	HomePlantStorage, HomePlantStorages
} from "../../../src/core/database/game/models/HomePlantStorage";
import PlayerPlantSlot, { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../../../src/core/database/game/models/InventoryInfo";
import { Materials } from "../../../src/core/database/game/models/Material";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { updateCollectMaterialsMission } from "../../../src/core/utils/MaterialLootUtils";
import { rescheduleGardenNotificationsUnderLock } from "../../../src/core/bot/GardenNotifications";
import { notifyQuestStepCompleted } from "../../../src/core/quests/Quests";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { GardenEarthQuality } from "../../../../Lib/src/types/GardenEarthQuality";
import { GardenAccessMode } from "../../../../Lib/src/types/GardenAccessMode";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { QUEST_IDS } from "../../../../Lib/src/constants/QuestConstants";
import {
	CommandReportGardenCompostNotEnoughPlantsRes, CommandReportGardenCompostRes, CommandReportGardenErrorRes, CommandReportGardenHarvestRes,
	CommandReportGardenPlantRes, CommandReportGardenWaterRes, CommandReportPlantTransferRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

const KEYCLOAK_ID = "gardener";
const NOW = new Date("2026-06-01T12:00:00Z").valueOf();
const SECOND = 1000;
const HOUR = 3600 * SECOND;
const STORAGE_CAPACITY = 5;

interface GardenerRow {
	id: number;
	keycloakId: string;
	lastGardenWatered: Date | null;
	save: ReturnType<typeof vi.fn>;
	getCurrentCityId: () => string;
}

let gardener: GardenerRow;
let lockedGardener: GardenerRow;
let home: Home;
let gardenFeatures: HomeLevel["features"];

function gardenerRow(): GardenerRow {
	return {
		id: 8,
		keycloakId: KEYCLOAK_ID,
		lastGardenWatered: null,
		save: vi.fn().mockResolvedValue(undefined),
		getCurrentCityId: (): string => "city"
	};
}

function asPlayer(row: GardenerRow): Player {
	return row as unknown as Player; // Only the garden fields, the model needs a database
}

function makeHome(features: Partial<HomeLevel["features"]> = {}): void {
	gardenFeatures = {
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.RICH,
		gardenPlantStorageCapacity: STORAGE_CAPACITY,
		...features
	} as HomeLevel["features"];
	home = {
		id: 21,
		getLevel: () => ({ features: gardenFeatures })
	} as unknown as Home; // Only the garden features of the home level are read
}

/**
 * A garden slot behaving like the model (its methods come from the model prototype)
 */
function gardenSlot(slot: number, plantId: PlantId | 0, plantedAgoMs?: number): HomeGardenSlot {
	return Object.assign(Object.create(HomeGardenSlot.prototype) as HomeGardenSlot, {
		slot,
		plantId,
		plantedAt: plantedAgoMs === undefined ? null : new Date(NOW - plantedAgoMs)
	});
}

function growthMs(plantId: PlantId, earthQuality = GardenEarthQuality.RICH): number {
	const plant = PlantConstants.getPlantById(plantId);
	if (!plant) {
		throw new Error(`Unknown plant ${plantId}`);
	}
	return GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality) * SECOND;
}

function storage(entries: [PlantId, number][]): HomePlantStorage[] {
	return entries.map(([plantId, quantity]) => ({
		plantId, quantity
	})) as HomePlantStorage[];
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	gardener = gardenerRow();
	lockedGardener = gardenerRow();
	makeHome();
	vi.spyOn(Players, "getByKeycloakId").mockResolvedValue(asPlayer(gardener));
	vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(home);
	vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({} as PlayerMissionsInfo);
	vi.mocked(withLockedEntities).mockImplementation((_keys, body) => body([lockedGardener, home] as never));
	vi.spyOn(HomeGardenSlots, "getOfHome").mockResolvedValue([]);
	vi.spyOn(HomeGardenSlots, "resetGrowthTimer").mockResolvedValue(undefined);
	vi.spyOn(HomeGardenSlots, "plantSeed").mockResolvedValue(undefined);
	vi.spyOn(HomeGardenSlots, "shiftPlantedAtForSlots").mockResolvedValue(undefined);
	vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue([]);
	vi.spyOn(HomePlantStorages, "addPlant").mockResolvedValue(0);
	vi.spyOn(Materials, "giveMaterial").mockResolvedValue(undefined as never);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.mocked(MissionsController.update).mockClear();
	vi.mocked(updateCollectMaterialsMission).mockClear();
	vi.mocked(rescheduleGardenNotificationsUnderLock).mockClear();
	vi.mocked(notifyQuestStepCompleted).mockClear();
	vi.mocked(withLockedEntities).mockClear();
	logGardenAction.mockClear();
});

describe("buildGardenData", () => {
	const seed = (plantId: PlantId | 0 | null): void => {
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue(plantId === null ? null : { plantId } as PlayerPlantSlot);
	};

	beforeEach(() => {
		vi.spyOn(HomeGardenSlots, "ensureSlotsForLevel").mockResolvedValue(undefined);
		vi.spyOn(HomePlantStorages, "initializeStorage").mockResolvedValue(undefined);
		vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue({ plantSlots: 2 } as Awaited<ReturnType<typeof InventoryInfos.getOfPlayer>>);
		vi.spyOn(PlayerPlantSlots, "initializeSlots").mockResolvedValue(undefined);
		seed(null);
	});

	const build = (accessMode?: GardenAccessMode): ReturnType<typeof buildGardenData> =>
		buildGardenData(home, { features: gardenFeatures } as HomeLevel, asPlayer(gardener), accessMode);

	it("should describe every plot: empty, growing with its ready time, and ready", async () => {
		const herbGrowth = growthMs(PlantId.COMMON_HERB);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
			gardenSlot(0, 0),
			gardenSlot(1, PlantId.COMMON_HERB, herbGrowth / 4),
			gardenSlot(2, PlantId.GOLDEN_CLOVER, growthMs(PlantId.GOLDEN_CLOVER))
		]);

		const garden = await build();

		expect(HomeGardenSlots.ensureSlotsForLevel).toHaveBeenCalledWith(home.id, 3);
		expect(HomePlantStorages.initializeStorage).toHaveBeenCalledWith(home.id);
		expect(PlayerPlantSlots.initializeSlots).toHaveBeenCalledWith(gardener.id, 2);
		expect(garden.plots).toEqual([
			{
				slot: 0, plantId: 0, growthProgress: 0, isReady: false, readyAtTimestamp: 0
			},
			{
				slot: 1,
				plantId: PlantId.COMMON_HERB,
				growthProgress: 0.25,
				isReady: false,
				readyAtTimestamp: Math.ceil((NOW + herbGrowth * 3 / 4) / SECOND)
			},
			{
				slot: 2, plantId: PlantId.GOLDEN_CLOVER, growthProgress: 1, isReady: true, readyAtTimestamp: 0
			}
		]);
		expect(garden.totalPlots).toBe(3);
	});

	it("should slow the growth on a poorer earth", async () => {
		makeHome({ gardenEarthQuality: GardenEarthQuality.POOR });
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, growthMs(PlantId.COMMON_HERB))]);

		const garden = await build();

		expect(garden.plots[0].isReady).toBe(false);
		expect(garden.plots[0].growthProgress).toBe(growthMs(PlantId.COMMON_HERB) / growthMs(PlantId.COMMON_HERB, GardenEarthQuality.POOR));
	});

	it("should list the stored plants with the storage capacity", async () => {
		vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue(storage([[PlantId.COMMON_HERB, 2], [PlantId.LUNAR_MOSS, 0]]));

		const garden = await build();

		expect(garden.plantStorage).toEqual([
			{
				plantId: PlantId.COMMON_HERB, quantity: 2, maxCapacity: STORAGE_CAPACITY
			},
			{
				plantId: PlantId.LUNAR_MOSS, quantity: 0, maxCapacity: STORAGE_CAPACITY
			}
		]);
	});

	it.each([
		[null, false, 0],
		[0, false, 0],
		[PlantId.IRON_ROOT, true, PlantId.IRON_ROOT]
	] as const)("should report the seed slot %s as hasSeed=%s", async (seedPlant, hasSeed, seedPlantId) => {
		seed(seedPlant);

		expect(await build()).toMatchObject({
			hasSeed, seedPlantId
		});
	});

	it("should tell when the garden can be watered again", async () => {
		gardener.lastGardenWatered = new Date(NOW - HOUR);
		expect((await build()).wateringAvailableAt).toBe(NOW - HOUR + GardenConstants.WATERING_COOLDOWN_MS);

		gardener.lastGardenWatered = new Date(NOW - GardenConstants.WATERING_COOLDOWN_MS);
		expect((await build()).wateringAvailableAt).toBeNull();

		gardener.lastGardenWatered = null;
		expect((await build()).wateringAvailableAt).toBeNull();
	});

	describe("eligibility", () => {
		const herbGrowth = growthMs(PlantId.COMMON_HERB);

		it("should allow every action on a full garden with a seed, an empty plot, a growing plant and stored plants", async () => {
			seed(PlantId.IRON_ROOT);
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				gardenSlot(0, 0),
				gardenSlot(1, PlantId.COMMON_HERB, herbGrowth / 2),
				gardenSlot(2, PlantId.GOLDEN_CLOVER, growthMs(PlantId.GOLDEN_CLOVER))
			]);
			vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue(storage([[PlantId.COMMON_HERB, 1]]));

			expect((await build()).eligibility).toEqual({
				canHarvest: true, canPlantSeed: true, canWaterGarden: true, canCompost: true
			});
			expect((await build(GardenAccessMode.READ_ONLY)).eligibility).toEqual({
				canHarvest: true, canPlantSeed: false, canWaterGarden: false, canCompost: false
			});
		});

		it("should forbid each action whose condition is missing", async () => {
			seed(null);
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				gardenSlot(0, 0),
				gardenSlot(1, PlantId.COMMON_HERB, herbGrowth / 2)
			]);
			vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue(storage([[PlantId.COMMON_HERB, 0]]));
			gardener.lastGardenWatered = new Date(NOW - HOUR);

			expect((await build()).eligibility).toEqual({
				canHarvest: false, canPlantSeed: false, canWaterGarden: false, canCompost: false
			});
		});

		it("should not offer to plant a seed in a full garden nor to water ready plants only", async () => {
			seed(PlantId.IRON_ROOT);
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, herbGrowth)]);

			expect((await build()).eligibility).toMatchObject({
				canPlantSeed: false, canWaterGarden: false
			});
		});
	});
});

describe("handleGardenHarvest", () => {
	const harvest = async (): Promise<CrowniclesPacket[]> => {
		const response: CrowniclesPacket[] = [];
		await handleGardenHarvest(KEYCLOAK_ID, {}, response);
		return response;
	};

	it("should answer an error to a player without home, without locking anything", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);

		const response = await harvest();

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandReportGardenErrorRes);
		expect(response[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS });
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("should answer an error when the home level is unknown", async () => {
		home.getLevel = (): HomeLevel | null => null;

		expect((await harvest())[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS });
	});

	it("should lock the player, the home and the missions of the player", async () => {
		await harvest();

		expect(PlayerMissionsInfos.getOfPlayer).toHaveBeenCalledWith(gardener.id);
		expect(withLockedEntities).toHaveBeenCalledWith([
			Player.lockKey(gardener.id), Home.lockKey(home.id), PlayerMissionsInfo.lockKey(gardener.id)
		], expect.any(Function));
	});

	it("should pick only the ready plants, store them, compost the overflow and reset the picked plots", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
			gardenSlot(0, 0),
			gardenSlot(1, PlantId.COMMON_HERB, growthMs(PlantId.COMMON_HERB)),
			gardenSlot(2, PlantId.GOLDEN_CLOVER, growthMs(PlantId.GOLDEN_CLOVER) - SECOND),
			gardenSlot(3, PlantId.ANCIENT_TREE, growthMs(PlantId.ANCIENT_TREE))
		]);
		vi.mocked(HomePlantStorages.addPlant).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
		vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue(storage([[PlantId.COMMON_HERB, 1], [PlantId.LUNAR_MOSS, 0]]));
		const compostPool = PlantConstants.getPlantById(PlantId.ANCIENT_TREE)?.compostMaterials ?? [];
		const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockReturnValue(compostPool[1]);

		const response = await harvest();

		expect(HomePlantStorages.addPlant).toHaveBeenCalledTimes(2);
		expect(HomePlantStorages.addPlant).toHaveBeenCalledWith(home.id, PlantId.COMMON_HERB, 1, STORAGE_CAPACITY);
		expect(HomePlantStorages.addPlant).toHaveBeenCalledWith(home.id, PlantId.ANCIENT_TREE, 1, STORAGE_CAPACITY);
		expect(pick).toHaveBeenCalledWith(compostPool);
		expect(Materials.giveMaterial).toHaveBeenCalledWith(lockedGardener.id, compostPool[1], 1);
		expect(HomeGardenSlots.resetGrowthTimer).toHaveBeenCalledTimes(2);
		expect(HomeGardenSlots.resetGrowthTimer).toHaveBeenCalledWith(home.id, 1);
		expect(HomeGardenSlots.resetGrowthTimer).toHaveBeenCalledWith(home.id, 3);
		expect(rescheduleGardenNotificationsUnderLock).toHaveBeenCalledWith(lockedGardener, home);
		expect(response[0]).toBeInstanceOf(CommandReportGardenHarvestRes);
		expect(response[0]).toEqual(expect.objectContaining({
			plantsHarvested: 1,
			plantsComposted: 1,
			compostResults: [{
				plantId: PlantId.ANCIENT_TREE, materialId: compostPool[1]
			}],
			plantStorage: [{
				plantId: PlantId.COMMON_HERB, quantity: 1, maxCapacity: STORAGE_CAPACITY
			}],
			harvestedSlots: [1, 3]
		}));
		expect(MissionsController.update).toHaveBeenCalledWith(lockedGardener, expect.any(Array), {
			missionId: "cultivatePlants", count: 2
		});
		expect(MissionsController.update).toHaveBeenCalledWith(lockedGardener, expect.any(Array), {
			missionId: "getAncestralTrees", count: 1
		});
		expect(updateCollectMaterialsMission).toHaveBeenCalledWith(lockedGardener, expect.any(Array), [{
			materialId: compostPool[1], quantity: 1
		}]);
		expect(logGardenAction).toHaveBeenCalledWith(expect.objectContaining({
			keycloakId: KEYCLOAK_ID, cityId: "city", quantity: 2
		}));
	});

	it("should send the harvest result before the mission notifications", async () => {
		const missionPacket = { name: "missionCompleted" } as unknown as CrowniclesPacket; // Opaque packet produced by the missions
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, growthMs(PlantId.COMMON_HERB))]);
		vi.mocked(MissionsController.update).mockImplementation((_player, response) => {
			response.push(missionPacket);
			return Promise.resolve(undefined as never);
		});

		const response = await harvest();

		expect(response).toHaveLength(2);
		expect(response[0]).toBeInstanceOf(CommandReportGardenHarvestRes);
		expect(response[1]).toBe(missionPacket);
	});

	it("should neither count missions nor log when nothing is ready", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, HOUR)]);

		const response = await harvest();

		expect(response[0]).toMatchObject({
			plantsHarvested: 0, plantsComposted: 0, harvestedSlots: []
		});
		expect(HomePlantStorages.addPlant).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
		expect(updateCollectMaterialsMission).not.toHaveBeenCalled();
		expect(logGardenAction).not.toHaveBeenCalled();
	});

	it("should not count the ancestral tree mission for other plants", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.CRYSTAL_FLOWER, growthMs(PlantId.CRYSTAL_FLOWER))]);

		await harvest();

		expect(MissionsController.update).toHaveBeenCalledOnce();
		expect(updateCollectMaterialsMission).not.toHaveBeenCalled();
	});
});

describe("handleGardenPlant", () => {
	const plant = async (gardenSlotIndex = -1): Promise<CrowniclesPacket[]> => {
		const response: CrowniclesPacket[] = [];
		await handleGardenPlant(KEYCLOAK_ID, { gardenSlot: gardenSlotIndex }, response);
		return response;
	};

	beforeEach(() => {
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue({ plantId: PlantId.LUNAR_MOSS } as PlayerPlantSlot);
		vi.spyOn(PlayerPlantSlots, "clearSeed").mockResolvedValue(undefined);
		vi.spyOn(HomeGardenSlots, "findEmptySlot").mockResolvedValue(gardenSlot(2, 0));
		vi.spyOn(HomeGardenSlots, "getSlot").mockResolvedValue(gardenSlot(1, 0));
		vi.spyOn(HomeGardenSlots, "getHighestPlantedId").mockResolvedValue(PlantId.GOLDEN_CLOVER);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.GOLDEN_CLOVER, HOUR), gardenSlot(2, 0)]);
	});

	it("should plant the seed in the first empty plot, consume it and count the mission", async () => {
		const response = await plant();

		expect(HomeGardenSlots.plantSeed).toHaveBeenCalledWith(home.id, 2, PlantId.LUNAR_MOSS);
		expect(PlayerPlantSlots.clearSeed).toHaveBeenCalledWith(lockedGardener.id);
		expect(rescheduleGardenNotificationsUnderLock).toHaveBeenCalledWith(lockedGardener, home);
		expect(response[0]).toBeInstanceOf(CommandReportGardenPlantRes);
		expect(response[0]).toMatchObject({
			plantId: PlantId.LUNAR_MOSS, gardenSlot: 2
		});
		expect(MissionsController.update).toHaveBeenCalledWith(lockedGardener, expect.any(Array), { missionId: "plantSeed" });
		expect(PlayerMissionsInfos.getOfPlayer).not.toHaveBeenCalled();
		expect(withLockedEntities).toHaveBeenCalledWith([Player.lockKey(gardener.id), Home.lockKey(home.id)], expect.any(Function));
		expect(logGardenAction).toHaveBeenCalledWith(expect.objectContaining({
			plantId: String(PlantId.LUNAR_MOSS), slot: 2
		}));
	});

	it("should plant in the chosen plot", async () => {
		await plant(1);

		expect(HomeGardenSlots.getSlot).toHaveBeenCalledWith(home.id, 1);
		expect(HomeGardenSlots.findEmptySlot).not.toHaveBeenCalled();
		expect(HomeGardenSlots.plantSeed).toHaveBeenCalledWith(home.id, 1, PlantId.LUNAR_MOSS);
	});

	it("should complete the seeds quest step of a plant more advanced than the whole garden only", async () => {
		await plant();
		expect(notifyQuestStepCompleted).toHaveBeenCalledWith(expect.any(Array), lockedGardener, {
			questId: QUEST_IDS.SEEDS, stepId: "lunarMoss"
		});

		vi.mocked(notifyQuestStepCompleted).mockClear();
		vi.mocked(HomeGardenSlots.getHighestPlantedId).mockResolvedValue(PlantId.LUNAR_MOSS);
		await plant();
		expect(notifyQuestStepCompleted).not.toHaveBeenCalled();
	});

	it.each([
		["no seed slot", null],
		["an empty seed slot", 0]
	] as const)("should refuse to plant with %s", async (_label, seedPlant) => {
		vi.mocked(PlayerPlantSlots.getSeedSlot).mockResolvedValue(seedPlant === null ? null : { plantId: seedPlant } as PlayerPlantSlot);

		const response = await plant();

		expect(response).toEqual([expect.objectContaining({ error: GardenConstants.GARDEN_ERRORS.NO_SEED })]);
		expect(HomeGardenSlots.plantSeed).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("should refuse when there is no empty plot, or the chosen one is taken", async () => {
		vi.mocked(HomeGardenSlots.findEmptySlot).mockResolvedValue(null);
		expect((await plant())[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT });

		vi.mocked(HomeGardenSlots.getSlot).mockResolvedValue(gardenSlot(1, PlantId.COMMON_HERB, HOUR));
		expect((await plant(1))[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT });
		expect(PlayerPlantSlots.clearSeed).not.toHaveBeenCalled();
	});

	it("should refuse a seed whose plant already grows in the garden", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.GOLDEN_CLOVER, HOUR), gardenSlot(1, PlantId.LUNAR_MOSS, HOUR), gardenSlot(2, 0)]);

		expect((await plant())[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.SEED_ALREADY_PLANTED });
		expect(PlayerPlantSlots.clearSeed).not.toHaveBeenCalled();
	});

	it("should refuse a player without home", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);

		expect((await plant())[0]).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_SEED });
	});
});

describe("handlePlantTransfer", () => {
	const transfer = (packet: Partial<Parameters<typeof handlePlantTransfer>[1]>): Promise<CrowniclesPacket> => handlePlantTransfer(KEYCLOAK_ID, {
		action: HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT, plantId: 0, playerSlot: 0, ...packet
	});

	beforeEach(() => {
		vi.spyOn(PlayerPlantSlots, "getPlantSlots").mockResolvedValue([
			{ slot: 1, plantId: PlantId.FIRE_BULB },
			{ slot: 2, plantId: 0 }
		] as PlayerPlantSlot[]);
		vi.spyOn(PlayerPlantSlots, "clearPlant").mockResolvedValue(undefined);
		vi.spyOn(PlayerPlantSlots, "setPlant").mockResolvedValue(undefined);
		vi.spyOn(PlayerPlantSlots, "findEmptyPlantSlot").mockResolvedValue({ slot: 2 } as PlayerPlantSlot);
		vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue({ quantity: 1 } as HomePlantStorage);
		vi.spyOn(HomePlantStorages, "removePlant").mockResolvedValue(true);
	});

	it("should deposit a carried plant into the storage and return the refreshed inventories", async () => {
		vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue(storage([[PlantId.FIRE_BULB, 1], [PlantId.LUNAR_MOSS, 0]]));

		const packet = await transfer({ playerSlot: 1 });

		expect(HomePlantStorages.addPlant).toHaveBeenCalledWith(home.id, PlantId.FIRE_BULB, 1, STORAGE_CAPACITY);
		expect(PlayerPlantSlots.clearPlant).toHaveBeenCalledWith(lockedGardener.id, 1);
		expect(packet).toBeInstanceOf(CommandReportPlantTransferRes);
		expect(packet).toMatchObject({
			success: true,
			plantStorage: [{
				plantId: PlantId.FIRE_BULB, quantity: 1, maxCapacity: STORAGE_CAPACITY
			}],
			playerPlantSlots: [{
				slot: 1, plantId: PlantId.FIRE_BULB
			}, {
				slot: 2, plantId: 0
			}]
		});
	});

	it("should keep the plant carried when the storage is full", async () => {
		vi.mocked(HomePlantStorages.addPlant).mockResolvedValue(1);

		expect(await transfer({ playerSlot: 1 })).toMatchObject({
			success: false, error: HomeConstants.PLANT_TRANSFER_ERRORS.STORAGE_FULL, plantStorage: [], playerPlantSlots: []
		});
		expect(PlayerPlantSlots.clearPlant).not.toHaveBeenCalled();
	});

	it.each([2, 7])("should refuse to deposit from the empty or unknown slot %i", async playerSlot => {
		expect(await transfer({ playerSlot })).toMatchObject({
			success: false, error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND
		});
		expect(HomePlantStorages.addPlant).not.toHaveBeenCalled();
	});

	it("should withdraw a stored plant into the first empty slot", async () => {
		const packet = await transfer({
			action: HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW, plantId: PlantId.LUNAR_MOSS
		});

		expect(HomePlantStorages.getForPlant).toHaveBeenCalledWith(home.id, PlantId.LUNAR_MOSS);
		expect(HomePlantStorages.removePlant).toHaveBeenCalledWith(home.id, PlantId.LUNAR_MOSS);
		expect(PlayerPlantSlots.setPlant).toHaveBeenCalledWith(lockedGardener.id, 2, PlantId.LUNAR_MOSS);
		expect(packet).toMatchObject({ success: true });
	});

	it("should refuse to withdraw a plant that is not stored", async () => {
		vi.mocked(HomePlantStorages.getForPlant).mockResolvedValueOnce(null).mockResolvedValueOnce({ quantity: 0 } as HomePlantStorage);

		for (let i = 0; i < 2; i++) {
			expect(await transfer({
				action: HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW, plantId: PlantId.LUNAR_MOSS
			})).toMatchObject({ error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND });
		}
		expect(HomePlantStorages.removePlant).not.toHaveBeenCalled();
	});

	it("should refuse to withdraw without an empty slot, keeping the plant stored", async () => {
		vi.mocked(PlayerPlantSlots.findEmptyPlantSlot).mockResolvedValue(null);

		expect(await transfer({
			action: HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW, plantId: PlantId.LUNAR_MOSS
		})).toMatchObject({ error: HomeConstants.PLANT_TRANSFER_ERRORS.NO_EMPTY_SLOT });
		expect(HomePlantStorages.removePlant).not.toHaveBeenCalled();
	});

	it("should refuse an unknown action and a player without home", async () => {
		expect(await transfer({ action: "steal" as never })).toMatchObject({ error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID });

		vi.mocked(Players.getByKeycloakId).mockResolvedValue(null);
		expect(await transfer({ playerSlot: 1 })).toMatchObject({ error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID });
		expect(HomePlantStorages.addPlant).not.toHaveBeenCalled();
	});
});

describe("handleGardenWater", () => {
	const water = (): Promise<CrowniclesPacket> => handleGardenWater(KEYCLOAK_ID, {});
	const advanceMs = (plantId: PlantId): number => GardenConstants.getWateringAdvanceSeconds(PlantConstants.getPlantById(plantId)?.growthTimeSeconds ?? 0, GardenEarthQuality.RICH) * SECOND;

	it("should advance every growing plant, grouped by advance, and start the cooldown", async () => {
		const herbGrowth = growthMs(PlantId.COMMON_HERB);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
			gardenSlot(0, 0),
			gardenSlot(1, PlantId.COMMON_HERB, herbGrowth - advanceMs(PlantId.COMMON_HERB)),
			gardenSlot(2, PlantId.COMMON_HERB, herbGrowth - advanceMs(PlantId.COMMON_HERB) - SECOND),
			gardenSlot(3, PlantId.ANCIENT_TREE, HOUR),
			gardenSlot(4, PlantId.GOLDEN_CLOVER, growthMs(PlantId.GOLDEN_CLOVER)),
			gardenSlot(5, PlantId.LUNAR_MOSS)
		]);

		const packet = await water();

		expect(packet).toBeInstanceOf(CommandReportGardenWaterRes);
		expect(packet).toMatchObject({
			slotsWatered: 3,
			slotsBecameReady: 1,
			nextWateringAvailableAt: NOW + GardenConstants.WATERING_COOLDOWN_MS
		});
		expect(HomeGardenSlots.shiftPlantedAtForSlots).toHaveBeenCalledTimes(2);
		expect(HomeGardenSlots.shiftPlantedAtForSlots).toHaveBeenCalledWith(home.id, [1, 2], advanceMs(PlantId.COMMON_HERB));
		expect(HomeGardenSlots.shiftPlantedAtForSlots).toHaveBeenCalledWith(home.id, [3], advanceMs(PlantId.ANCIENT_TREE));
		expect(lockedGardener.lastGardenWatered).toEqual(new Date(NOW));
		expect(lockedGardener.save).toHaveBeenCalledOnce();
		expect(rescheduleGardenNotificationsUnderLock).toHaveBeenCalledWith(lockedGardener, home);
		expect(logGardenAction).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }));
	});

	it("should refuse during the cooldown, read under the lock, and tell when it ends", async () => {
		lockedGardener.lastGardenWatered = new Date(NOW - HOUR);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, HOUR)]);

		const packet = await water();

		expect(packet).toBeInstanceOf(CommandReportGardenErrorRes);
		expect(packet).toMatchObject({
			error: GardenConstants.GARDEN_ERRORS.WATERING_ON_COOLDOWN,
			availableAt: NOW - HOUR + GardenConstants.WATERING_COOLDOWN_MS
		});
		expect(HomeGardenSlots.shiftPlantedAtForSlots).not.toHaveBeenCalled();
	});

	it("should allow watering again once the cooldown is over", async () => {
		lockedGardener.lastGardenWatered = new Date(NOW - GardenConstants.WATERING_COOLDOWN_MS);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, PlantId.COMMON_HERB, HOUR)]);

		expect(await water()).toBeInstanceOf(CommandReportGardenWaterRes);
	});

	it("should not start the cooldown when no plant is growing", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([gardenSlot(0, 0), gardenSlot(1, PlantId.COMMON_HERB, growthMs(PlantId.COMMON_HERB))]);

		const packet = await water();

		expect(packet).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER });
		expect((packet as CommandReportGardenErrorRes).availableAt).toBeUndefined();
		expect(lockedGardener.save).not.toHaveBeenCalled();
	});

	it("should refuse a player without garden", async () => {
		const noGarden = async (): Promise<void> => {
			expect(await water()).toMatchObject({ error: GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER });
		};
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);
		await noGarden();
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);
		await noGarden();
		makeHome({ gardenPlots: 0 });
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		await noGarden();
		home.getLevel = (): HomeLevel | null => null;
		await noGarden();

		expect(withLockedEntities).not.toHaveBeenCalled();
	});
});

describe("handleGardenCompostReaction", () => {
	const compost = async (plantId: PlantId, quantity: number): Promise<CrowniclesPacket[]> => {
		const response: CrowniclesPacket[] = [];
		await handleGardenCompostReaction(asPlayer(gardener), plantId, quantity, response);
		return response;
	};

	beforeEach(() => {
		vi.spyOn(Home, "withLocked").mockImplementation((_id, body) => body(home));
		vi.spyOn(HomePlantStorages, "removePlantsUnderLock").mockResolvedValue(true);
	});

	it("should turn each composted plant into one material of its pool", async () => {
		const pool = PlantConstants.getPlantById(PlantId.IRON_ROOT)?.compostMaterials ?? [];
		vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockReturnValueOnce(pool[0]).mockReturnValueOnce(pool[2]).mockReturnValueOnce(pool[0]);

		const response = await compost(PlantId.IRON_ROOT, 3);

		expect(HomePlantStorages.removePlantsUnderLock).toHaveBeenCalledWith(home.id, PlantId.IRON_ROOT, 3);
		expect(Materials.giveMaterial).toHaveBeenCalledTimes(3);
		expect(response[0]).toBeInstanceOf(CommandReportGardenCompostRes);
		expect(response[0]).toMatchObject({
			plantId: PlantId.IRON_ROOT, quantity: 3, materials: [pool[0], pool[2], pool[0]]
		});
		expect(updateCollectMaterialsMission).toHaveBeenCalledWith(asPlayer(gardener), response, [pool[0], pool[2], pool[0]].map(materialId => ({
			materialId, quantity: 1
		})));
		expect(logGardenAction).toHaveBeenCalledWith(expect.objectContaining({
			plantId: String(PlantId.IRON_ROOT), quantity: 3
		}));
	});

	it("should give nothing when the stored plants are not enough", async () => {
		vi.mocked(HomePlantStorages.removePlantsUnderLock).mockResolvedValue(false);

		const response = await compost(PlantId.IRON_ROOT, 3);

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandReportGardenCompostNotEnoughPlantsRes);
		expect(Materials.giveMaterial).not.toHaveBeenCalled();
		expect(updateCollectMaterialsMission).not.toHaveBeenCalled();
	});

	it("should refuse a player without home or an unknown plant", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);
		expect((await compost(PlantId.IRON_ROOT, 1))[0]).toBeInstanceOf(CommandReportGardenCompostNotEnoughPlantsRes);

		expect((await compost(99 as PlantId, 1))[0]).toMatchObject({
			plantId: 99, quantity: 1
		});
		expect(HomePlantStorages.removePlantsUnderLock).not.toHaveBeenCalled();
	});
});
