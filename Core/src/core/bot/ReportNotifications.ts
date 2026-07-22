import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { MapLocationDataController } from "../../data/MapLocation";
import { ScheduledReportNotifications } from "../database/game/models/ScheduledReportNotification";
import { PacketUtils } from "../utils/PacketUtils";

/**
 * Dispatch every arrival notification whose scheduled time has passed.
 *
 * Each row is claimed (atomically deleted) before being sent: only the caller
 * that wins the delete is allowed to dispatch, so this poller never sends a
 * notification that the `Player.afterSave` hook has already sent, and vice
 * versa (issue #4562).
 */
export async function processDueReportNotifications(): Promise<void> {
	const notifications = await ScheduledReportNotifications.getNotificationsBeforeDate(new Date());
	if (notifications.length === 0) {
		return;
	}

	await Promise.all(notifications.map(async notification => {
		if (!await ScheduledReportNotifications.claimNotification(notification.playerId)) {
			return;
		}
		PacketUtils.sendNotifications([
			makePacket(ReachDestinationNotificationPacket, {
				keycloakId: notification.keycloakId,
				mapType: MapLocationDataController.instance.getById(notification.mapId)!.type,
				mapId: notification.mapId
			})
		]);
	}));
}
