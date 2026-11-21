import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NotificationPacket } from "../../../../Lib/src/packets/notifications/NotificationPacket";
import { GardenPlantReadyNotificationPacket } from "../../../../Lib/src/packets/notifications/GardenPlantReadyNotificationPacket";
import { GardenAllPlantsReadyNotificationPacket } from "../../../../Lib/src/packets/notifications/GardenAllPlantsReadyNotificationPacket";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	asMilliseconds, Millisecond
} from "../../../../Lib/src/types/TimeTypes";
import { Player } from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import {
	GARDEN_NOTIFICATION_TYPES, GardenNotificationType, ScheduledGardenNotification, ScheduledGardenNotifications
} from "../database/game/models/ScheduledGardenNotification";
import { PacketUtils } from "../utils/PacketUtils";

type PlantReadyTime = {
	plantId: PlantId;
	readyAt: Millisecond;
};

type GardenOwner = Pick<Player, "id" | "keycloakId">;

async function getPlantReadyTimes(home: Home): Promise<PlantReadyTime[] | null> {
	const homeLevel = home.getLevel();
	if (!homeLevel) {
		return null;
	}
	const earthQuality = homeLevel.features.gardenEarthQuality;
	const readyTimes: PlantReadyTime[] = [];
	for (const slot of await HomeGardenSlots.getOfHome(home.id)) {
		const plant = PlantConstants.getPlantById(slot.plantId);
		const readyAt = plant ? slot.getReadyAt(GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)) : null;
		if (plant && readyAt !== null) {
			readyTimes.push({
				plantId: plant.id,
				readyAt
			});
		}
	}
	return readyTimes;
}

/**
 * The DATETIME column drops the milliseconds: flooring them beforehand keeps the stored date equal to the in-memory one,
 * so a plant ready at `readyAt` always satisfies `readyAt >= scheduledAt` when the notification is processed
 */
function floorToSecond(timestamp: Millisecond): Date {
	return new Date(Math.floor(timestamp / TimeConstants.MS_TIME.SECOND) * TimeConstants.MS_TIME.SECOND);
}

async function scheduleOrDelete(owner: GardenOwner, type: GardenNotificationType, readyAt: Millisecond | undefined): Promise<void> {
	if (readyAt === undefined) {
		await ScheduledGardenNotifications.deleteNotification(owner.id, type);
		return;
	}
	await ScheduledGardenNotifications.scheduleNotification({
		playerId: owner.id,
		type,
		keycloakId: owner.keycloakId,
		scheduledAt: floorToSecond(readyAt)
	});
}

/**
 * Schedule the next "a plant is ready" notification at the next plant to finish growing,
 * and the "all plants are ready" one when the last growing plant finishes.
 * Plants already ready are ignored: the player is notified only about growth still to come.
 */
async function scheduleFromReadyTimes(owner: GardenOwner, readyTimes: PlantReadyTime[], now: Millisecond): Promise<void> {
	const futureReadyTimes = readyTimes.map(readyTime => readyTime.readyAt).filter(readyAt => readyAt > now);
	const nextPlantReadyAt = futureReadyTimes.length > 0 ? asMilliseconds(Math.min(...futureReadyTimes)) : undefined;
	const allPlantsReadyAt = futureReadyTimes.length > 0 ? asMilliseconds(Math.max(...futureReadyTimes)) : undefined;
	await scheduleOrDelete(owner, GARDEN_NOTIFICATION_TYPES.PLANT_READY, nextPlantReadyAt);
	await scheduleOrDelete(owner, GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY, allPlantsReadyAt);
}

/**
 * Recompute the garden notifications of a player after a change of the growth of their plants
 * (plant, harvest, watering, earth quality). Must run under the lock of the home, like every garden mutation.
 */
export async function rescheduleGardenNotificationsUnderLock(owner: GardenOwner, home: Locked<Home>): Promise<void> {
	const readyTimes = await getPlantReadyTimes(home);
	if (!readyTimes) {
		await ScheduledGardenNotifications.deleteOfPlayer(owner.id);
		return;
	}
	await scheduleFromReadyTimes(owner, readyTimes, asMilliseconds(Date.now()));
}

type DueNotificationPacketBuilder = (notification: ScheduledGardenNotification, readyTimes: PlantReadyTime[], now: Millisecond) => NotificationPacket | null;

/**
 * Notify the plants that became ready since the scheduled date. None when they are no longer ready (stale schedule).
 */
const buildPlantReadyPacket: DueNotificationPacketBuilder = (notification, readyTimes, now) => {
	const scheduledAt = notification.scheduledAt.valueOf();
	const plantIds = [
		...new Set(readyTimes
			.filter(readyTime => readyTime.readyAt >= scheduledAt && readyTime.readyAt <= now)
			.map(readyTime => readyTime.plantId))
	];
	return plantIds.length > 0
		? makePacket(GardenPlantReadyNotificationPacket, {
			keycloakId: notification.keycloakId,
			plantIds
		})
		: null;
};

/**
 * Notify once the last plant became ready since the scheduled date, and only if no plant is still growing
 */
const buildAllPlantsReadyPacket: DueNotificationPacketBuilder = (notification, readyTimes, now) => {
	const allReady = readyTimes.length > 0
		&& readyTimes.every(readyTime => readyTime.readyAt <= now)
		&& Math.max(...readyTimes.map(readyTime => readyTime.readyAt)) >= notification.scheduledAt.valueOf();
	return allReady ? makePacket(GardenAllPlantsReadyNotificationPacket, { keycloakId: notification.keycloakId }) : null;
};

const DUE_NOTIFICATION_PACKET_BUILDERS: Record<GardenNotificationType, DueNotificationPacketBuilder> = {
	[GARDEN_NOTIFICATION_TYPES.PLANT_READY]: buildPlantReadyPacket,
	[GARDEN_NOTIFICATION_TYPES.ALL_PLANTS_READY]: buildAllPlantsReadyPacket
};

async function processPlayerDueNotifications(owner: GardenOwner, notifications: ScheduledGardenNotification[], now: Millisecond): Promise<NotificationPacket[]> {
	const home = await Homes.getOfPlayer(owner.id);
	if (!home) {
		await ScheduledGardenNotifications.deleteOfPlayer(owner.id);
		return [];
	}

	return await Home.withLocked(home.id, async lockedHome => {
		const readyTimes = await getPlantReadyTimes(lockedHome);
		if (!readyTimes) {
			await ScheduledGardenNotifications.deleteOfPlayer(owner.id);
			return [];
		}
		const packets = notifications
			.map(notification => DUE_NOTIFICATION_PACKET_BUILDERS[notification.type](notification, readyTimes, now))
			.filter((packet): packet is NotificationPacket => packet !== null);
		await scheduleFromReadyTimes(owner, readyTimes, now);
		return packets;
	});
}

export async function processDueGardenNotifications(): Promise<void> {
	const now = asMilliseconds(Date.now());
	const dueNotifications = await ScheduledGardenNotifications.getNotificationsBeforeDate(new Date(now));
	if (dueNotifications.length === 0) {
		return;
	}

	const notificationsByPlayer = new Map<number, ScheduledGardenNotification[]>();
	for (const notification of dueNotifications) {
		notificationsByPlayer.set(notification.playerId, [...notificationsByPlayer.get(notification.playerId) ?? [], notification]);
	}

	const packets: NotificationPacket[] = [];
	for (const [playerId, notifications] of notificationsByPlayer) {
		try {
			packets.push(...await processPlayerDueNotifications({
				id: playerId,
				keycloakId: notifications[0].keycloakId
			}, notifications, now));
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Failed to process the garden notifications of player ${playerId}`, error);
		}
	}

	if (packets.length > 0) {
		PacketUtils.sendNotifications(packets);
	}
}
