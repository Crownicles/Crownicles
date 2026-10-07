import { FromServerPacket } from "../FromServerPacket";
import { NotificationType } from "../../objects/NotificationPreferences";

/**
 * A notification that reached the player while the app is open: the same words as the push, shown
 * in the app, and a hint of what to refresh.
 */
export class AppNotificationRes extends FromServerPacket {
	public static readonly wireName = "AppNotificationRes";

	notificationType!: NotificationType;

	title!: string;

	body!: string;
}
