import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/ScheduledGardenNotification", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/ScheduledGardenNotification")>(),
	ScheduledGardenNotifications: {
		scheduleNotification: vi.fn(),
		deleteNotification: vi.fn(),
		deleteOfPlayer: vi.fn(),
		getNotificationsBeforeDate: vi.fn()
	}
}));

vi.mock("../../../src/core/database/game/models/HomeGardenSlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/HomeGardenSlot")>(),
	HomeGardenSlots: { getOfHome: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/Home", () => ({
	Home: { withLocked: vi.fn() },
	Homes: { getOfPlayer: vi.fn() }
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: { sendNotifications: vi.fn() }
}));

import {
	processDueGardenNotifications, rescheduleGardenNotificationsUnderLock
} from "../../../src/core/bot/GardenNotifications";
import {
	GARDEN_NOTIFICATION_TYPES, ScheduledGardenNotifications
} from "../../../src/core/database/game/models/ScheduledGardenNotification";
import {
	HomeGardenSlot, HomeGardenSlots
} from "../../../src/core/database/game/models/HomeGardenSlot";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenEarthQuality } from "../../../../Lib/src/types/GardenEarthQuality";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import { GardenPlantReadyNotificationPacket } from "../../../../Lib/src/packets/notifications/GardenPlantReadyNotificationPacket";
import { GardenAllPlantsReadyNotificationPacket } from "../../../../Lib/src/packets/notifications/GardenAllPlantsReadyNotificationPacket";

const NOW = new Date("2026-11-18T12:00:00Z").valueOf();
const MINUTE = TimeConstants.MS_TIME.MINUTE;
const OWNER = {
	id: 7,
	keycloakId: "player"
};

// Earth quality RICH has a growth multiplier of 1: a plant is ready exactly after its base growth time
const home = {
	id: 3,
	getLevel: () => ({ features: { gardenEarthQuality: GardenEarthQuality.RICH } })
} as never;

function growthMs(plantId: PlantId): number {
	const plant = PlantConstants.getPlantById(plantId);
	if (!plant) {
		throw new Error(`Unknown plant ${plantId}`);
	}
	return plant.growthTimeSeconds * TimeConstants.MS_TIME.SECOND;
}

/**
 * Garden slot whose plant is ready at `readyAt`
 */
function slotReadyAt(plantId: PlantId, readyAt: number): HomeGardenSlot {
	return Object.assign(Object.create(HomeGardenSlot.prototype) as HomeGardenSlot, {
		plantId,
		plantedAt: new Date(readyAt - growthMs(plantId))
	});
}

function scheduledAtOf(type: string): Date | undefined {
	return vi.mocked(ScheduledGardenNotifications.scheduleNotification).mock.calls
		.find(([params]) => params.type === type)?.[0].scheduledAt;
}

function dueNotification(type: string, scheduledAt: number): object {
	return {
		playerId: OWNER.id,
		keycloakId: OWNER.keycloakId,
		type,
		scheduledAt: new Date(scheduledAt)
	};
}

describe("GardenNotifications", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		vi.clearAllMocks();
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
		vi.mocked(Home.withLocked).mockImplementation((_id, fn) => fn(home) as never);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("rescheduleGardenNotificationsUnderLock", () => {
		it("schedules the next plant and the last plant to finish growing", async () => {
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				slotReadyAt(PlantId.COMMON_HERB, NOW - MINUTE),
				slotReadyAt(PlantId.GOLDEN_CLOVER, NOW + 30 * MINUTE),
				slotReadyAt(PlantId.LUNAR_MOSS, NOW + 90 * MINUTE)
			]);

			await rescheduleGardenNotificationsUnderLock(OWNER, home);

			expect(scheduledAtOf(GARDEN_NOTIFICATION_TYPES.PLANT_READY)).toEqual(new Date(NOW + 30 * MINUTE));
			expect(scheduledAtOf(GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY)).toEqual(new Date(NOW + 90 * MINUTE));
		});

		it("cancels both notifications when no plant is still growing", async () => {
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([slotReadyAt(PlantId.COMMON_HERB, NOW - MINUTE)]);

			await rescheduleGardenNotificationsUnderLock(OWNER, home);

			expect(ScheduledGardenNotifications.scheduleNotification).not.toHaveBeenCalled();
			expect(ScheduledGardenNotifications.deleteNotification).toHaveBeenCalledWith(OWNER.id, GARDEN_NOTIFICATION_TYPES.PLANT_READY);
			expect(ScheduledGardenNotifications.deleteNotification).toHaveBeenCalledWith(OWNER.id, GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY);
		});
	});

	describe("processDueGardenNotifications", () => {
		it("notifies the plant that just became ready and schedules the next one", async () => {
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				slotReadyAt(PlantId.COMMON_HERB, NOW - 2 * MINUTE),
				slotReadyAt(PlantId.GOLDEN_CLOVER, NOW + 30 * MINUTE)
			]);
			vi.mocked(ScheduledGardenNotifications.getNotificationsBeforeDate)
				.mockResolvedValue([dueNotification(GARDEN_NOTIFICATION_TYPES.PLANT_READY, NOW - 2 * MINUTE)] as never);

			await processDueGardenNotifications();

			const packets = vi.mocked(PacketUtils.sendNotifications).mock.calls[0][0];
			expect(packets).toHaveLength(1);
			expect(packets[0]).toBeInstanceOf(GardenPlantReadyNotificationPacket);
			expect(packets[0]).toMatchObject({
				keycloakId: OWNER.keycloakId,
				plantIds: [PlantId.COMMON_HERB]
			});
			expect(scheduledAtOf(GARDEN_NOTIFICATION_TYPES.PLANT_READY)).toEqual(new Date(NOW + 30 * MINUTE));
		});

		it("drops a stale notification whose plant is no longer ready and reschedules it", async () => {
			// The plant was harvested before the notification was processed: its growth restarted
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([slotReadyAt(PlantId.COMMON_HERB, NOW + 60 * MINUTE)]);
			vi.mocked(ScheduledGardenNotifications.getNotificationsBeforeDate)
				.mockResolvedValue([dueNotification(GARDEN_NOTIFICATION_TYPES.PLANT_READY, NOW - 2 * MINUTE)] as never);

			await processDueGardenNotifications();

			expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
			expect(scheduledAtOf(GARDEN_NOTIFICATION_TYPES.PLANT_READY)).toEqual(new Date(NOW + 60 * MINUTE));
		});

		it("notifies when the last plant becomes ready and does not reschedule", async () => {
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				slotReadyAt(PlantId.COMMON_HERB, NOW - 60 * MINUTE),
				slotReadyAt(PlantId.GOLDEN_CLOVER, NOW - MINUTE)
			]);
			vi.mocked(ScheduledGardenNotifications.getNotificationsBeforeDate)
				.mockResolvedValue([dueNotification(GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY, NOW - MINUTE)] as never);

			await processDueGardenNotifications();

			const packets = vi.mocked(PacketUtils.sendNotifications).mock.calls[0][0];
			expect(packets).toHaveLength(1);
			expect(packets[0]).toBeInstanceOf(GardenAllPlantsReadyNotificationPacket);
			expect(ScheduledGardenNotifications.scheduleNotification).not.toHaveBeenCalled();
			expect(ScheduledGardenNotifications.deleteNotification).toHaveBeenCalledWith(OWNER.id, GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY);
		});

		it("does not notify that all plants are ready while one is still growing", async () => {
			vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
				slotReadyAt(PlantId.COMMON_HERB, NOW - 60 * MINUTE),
				slotReadyAt(PlantId.GOLDEN_CLOVER, NOW + 20 * MINUTE)
			]);
			vi.mocked(ScheduledGardenNotifications.getNotificationsBeforeDate)
				.mockResolvedValue([dueNotification(GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY, NOW - MINUTE)] as never);

			await processDueGardenNotifications();

			expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
			expect(scheduledAtOf(GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY)).toEqual(new Date(NOW + 20 * MINUTE));
		});
	});
});
