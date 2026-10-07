import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	NotificationPreferences, NotificationType
} from "../../types/NotificationPreferences";

/** The app reads the player's notification settings for the app. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandNotificationPreferencesReq extends CrowniclesPacket {}

/** The app turns one kind of notification on or off. */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandNotificationPreferenceSetReq extends CrowniclesPacket {
	type!: NotificationType;

	enabled!: boolean;
}

/** The app's notification settings; sent to the app only, Discord keeps its own. */
@sendablePacket(PacketDirection.NONE)
export class CommandNotificationPreferencesRes extends CrowniclesPacket {
	preferences!: NotificationPreferences;
}

/**
 * Discord's settings for a player, sent once so the app starts from them.
 * `preferences` is absent when the player has no Discord account or never changed its settings.
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class DiscordNotificationPreferencesPacket extends CrowniclesPacket {
	keycloakId!: string;

	preferences?: NotificationPreferences;
}
