import { NotificationPacket } from "./NotificationPacket";
import { NotificationType } from "../../types/NotificationPreferences";
import { PushDevice } from "../../types/PushDevices";

/** A notification the player wants in the app, with the devices to push it to; none when they have not allowed any. */
export type AppNotificationDelivery = {
	notificationType: NotificationType;
	notification: {
		type: string;
		packet: NotificationPacket;
	};
	devices: PushDevice[];
};

/** What Core publishes for the app, next to what it publishes for Discord. */
export interface AppNotificationsSerializedPacket {
	deliveries: AppNotificationDelivery[];
}
