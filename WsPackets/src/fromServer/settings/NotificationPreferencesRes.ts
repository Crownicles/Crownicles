import { FromServerPacket } from "../FromServerPacket";
import { NotificationPreferences } from "../../objects/NotificationPreferences";

/** The app's notification settings, as an answer or pushed once Discord's have been taken over. */
export class NotificationPreferencesRes extends FromServerPacket {
	public static readonly wireName = "NotificationPreferencesRes";

	preferences!: NotificationPreferences;
}
