import { FromClientPacket } from "./FromClientPacket";
import { NotificationType } from "../objects/NotificationPreferences";

export class NotificationPreferencesReq extends FromClientPacket {
	public static readonly wireName = "NotificationPreferencesReq";
}

export class NotificationPreferenceSetReq extends FromClientPacket {
	public static readonly wireName = "NotificationPreferenceSetReq";

	type!: NotificationType;

	enabled!: boolean;
}
