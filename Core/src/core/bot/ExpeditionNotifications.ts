import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ExpeditionFinishedNotificationPacket } from "../../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import { ScheduledExpeditionNotifications } from "../database/game/models/ScheduledExpeditionNotification";
import { PacketUtils } from "../utils/PacketUtils";

export async function processDueExpeditionNotifications(): Promise<void> {
	const notifications = await ScheduledExpeditionNotifications.getNotificationsBeforeDate(new Date());
	if (notifications.length === 0) {
		return;
	}

	PacketUtils.sendNotifications(notifications.map(notification => makePacket(ExpeditionFinishedNotificationPacket, {
		keycloakId: notification.keycloakId,
		petId: notification.petId,
		petNickname: notification.petNickname,
		petSex: notification.petSex
	})));
	await ScheduledExpeditionNotifications.bulkDelete(notifications);
}
