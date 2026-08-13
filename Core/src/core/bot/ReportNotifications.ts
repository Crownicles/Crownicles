import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { MapLocationDataController } from "../../data/MapLocation";
import type Player from "../database/game/models/Player";
import { ScheduledReportNotifications } from "../database/game/models/ScheduledReportNotification";
import { TravelTime } from "../maps/TravelTime";
import { PacketUtils } from "../utils/PacketUtils";

/**
 * Send the arrival notification of a player, whose row has already been claimed.
 */
function sendArrivalNotification(keycloakId: string, mapId: number): void {
	const mapLocation = MapLocationDataController.instance.getById(mapId);
	if (!mapLocation) {
		return;
	}
	PacketUtils.sendNotifications([
		makePacket(ReachDestinationNotificationPacket, {
			keycloakId,
			mapType: mapLocation.type,
			mapId
		})
	]);
}

/**
 * React to a change of the travel timers of a player: either postpone their pending arrival
 * notification, or dispatch it because they have arrived.
 *
 * The pending row is only ever created by `Maps.startTravel`: once the arrival has been notified,
 * a later change of the timers (an alteration granted by the arrival big event, then the player
 * settling in the city) must not resurrect a notification for a travel that is over (issue #4626).
 */
export async function dispatchOrRescheduleArrivalNotification(player: Player): Promise<void> {
	const now = new Date();
	const travelEndDate = new Date(TravelTime.getTravelDataSimplified(player, now).travelEndTime);
	const destinationId = player.getDestinationId();

	if (travelEndDate > now && destinationId !== null) {
		await ScheduledReportNotifications.rescheduleNotification(player.id, destinationId, travelEndDate);
		return;
	}

	/*
	 * Arrived: claim the pending row atomically. Only the winner of the claim dispatches
	 * the notification, so the periodic poller can never send a duplicate (issue #4562).
	 */
	const pendingReportNotification = await ScheduledReportNotifications.getPendingNotification(player.id);
	if (!pendingReportNotification) {
		return;
	}
	if (!await ScheduledReportNotifications.claimNotification(player.id) || destinationId !== pendingReportNotification.mapId) {
		return;
	}
	sendArrivalNotification(pendingReportNotification.keycloakId, pendingReportNotification.mapId);
}

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
		sendArrivalNotification(notification.keycloakId, notification.mapId);
	}));
}
