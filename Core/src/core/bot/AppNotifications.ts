import { NotificationPacket } from "../../../../Lib/src/packets/notifications/NotificationPacket";
import {
	AppNotificationDelivery, AppNotificationsSerializedPacket
} from "../../../../Lib/src/packets/notifications/AppNotificationsSerializedPacket";
import {
	NOTIFICATION_TYPES, NotificationType
} from "../../../../Lib/src/types/NotificationPreferences";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { DailyBonusNotificationPacket } from "../../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import { EnergyFullNotificationPacket } from "../../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { GuildDailyNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import { GuildKickNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import { GuildStatusChangeNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { PlayerFreedFromJailNotificationPacket } from "../../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import { PlayerWasAttackedNotificationPacket } from "../../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import { ExpeditionFinishedNotificationPacket } from "../../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import { TournamentNotificationPacket } from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import { MqttTopicUtils } from "../../../../Lib/src/utils/MqttTopicUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { AppNotificationPreference } from "../database/game/models/AppNotificationPreference";
import { AppPushDevices } from "../database/game/models/AppPushDevice";
import { botConfig } from "../../bootstrap";
import { mqttClient } from "../../mqttClient";

/** The setting each notification answers to in the app; the others, such as a GDPR export, stay on Discord. */
const APP_NOTIFICATION_TYPES: ReadonlyMap<string, NotificationType> = new Map([
	[ReachDestinationNotificationPacket.name, NOTIFICATION_TYPES.REPORT],
	[DailyBonusNotificationPacket.name, NOTIFICATION_TYPES.DAILY_BONUS],
	[EnergyFullNotificationPacket.name, NOTIFICATION_TYPES.ENERGY],
	[GuildDailyNotificationPacket.name, NOTIFICATION_TYPES.GUILD_DAILY],
	[GuildKickNotificationPacket.name, NOTIFICATION_TYPES.GUILD_KICK],
	[GuildStatusChangeNotificationPacket.name, NOTIFICATION_TYPES.GUILD_STATUS_CHANGE],
	[PlayerFreedFromJailNotificationPacket.name, NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL],
	[PlayerWasAttackedNotificationPacket.name, NOTIFICATION_TYPES.FIGHT_CHALLENGE],
	[ExpeditionFinishedNotificationPacket.name, NOTIFICATION_TYPES.PET_EXPEDITION],
	[TournamentNotificationPacket.name, NOTIFICATION_TYPES.TOURNAMENT]
]);

export function appNotificationType(notification: NotificationPacket): NotificationType | undefined {
	return APP_NOTIFICATION_TYPES.get(notification.constructor.name);
}

type TypedNotification = {
	notification: NotificationPacket;
	notificationType: NotificationType;
};

/**
 * The notifications players want in the app, with the devices to reach them on.
 * A player without app settings has never opened the app: Discord alone tells them.
 */
export async function appNotificationDeliveries(notifications: NotificationPacket[]): Promise<AppNotificationDelivery[]> {
	const typed = notifications.flatMap((notification): TypedNotification[] => {
		const notificationType = appNotificationType(notification);
		return notificationType
			? [
				{
					notification, notificationType
				}
			]
			: [];
	});
	const keycloakIds = [...new Set(typed.map(({ notification }) => notification.keycloakId))];
	if (keycloakIds.length === 0) {
		return [];
	}
	const [preferences, devices] = await Promise.all([
		AppNotificationPreference.findAll({ where: { keycloakId: keycloakIds } }),
		AppPushDevices.ofPlayers(keycloakIds)
	]);
	const preferencesByPlayer = new Map(preferences.map(row => [row.keycloakId, row]));
	return typed
		.filter(({
			notification, notificationType
		}) => preferencesByPlayer.get(notification.keycloakId)?.[notificationType] === true)
		.map(({
			notification, notificationType
		}) => ({
			notificationType,
			notification: {
				type: notification.constructor.name,
				packet: notification
			},
			devices: devices.get(notification.keycloakId) ?? []
		}));
}

/**
 * Hands RestWs what to push to the app. Not retained: a notification that arrives after RestWs restarts
 * is still delivered by its persistent session, but must never be pushed a second time.
 */
export async function publishAppNotifications(notifications: NotificationPacket[]): Promise<void> {
	const deliveries = await appNotificationDeliveries(notifications);
	if (deliveries.length === 0) {
		return;
	}
	const serialized: AppNotificationsSerializedPacket = { deliveries };
	mqttClient.publish(MqttTopicUtils.getAppNotificationsTopic(botConfig.PREFIX), JSON.stringify(serialized), { qos: 1 });
	CrowniclesLogger.debug("Sent app notifications", { count: deliveries.length });
}
