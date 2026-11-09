import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandNotificationPreferenceSetReq,
	CommandNotificationPreferencesReq,
	CommandNotificationPreferencesRes,
	DiscordNotificationPreferencesPacket
} from "../../../../../Lib/src/packets/commands/CommandNotificationPreferencesPacket";
import {
	AppNotificationPreference, AppNotificationPreferences, preferencesOf
} from "../../database/game/models/AppNotificationPreference";
import {
	ALL_NOTIFICATION_TYPES, isNotificationType, NotificationPreferences
} from "../../../../../Lib/src/types/NotificationPreferences";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

function preferencesResponse(row: AppNotificationPreference): CommandNotificationPreferencesRes {
	return makePacket(CommandNotificationPreferencesRes, { preferences: preferencesOf(row) });
}

/** Keeps only well-formed settings: this packet comes over MQTT and must not write arbitrary columns. */
function validPreferences(preferences: unknown): NotificationPreferences | undefined {
	if (typeof preferences !== "object" || preferences === null) {
		return undefined;
	}
	const values = preferences as Record<string, unknown>;
	return ALL_NOTIFICATION_TYPES.every(type => typeof values[type] === "boolean")
		? Object.fromEntries(ALL_NOTIFICATION_TYPES.map(type => [type, values[type]])) as NotificationPreferences
		: undefined;
}

export default class NotificationPreferencesHandlers {
	@packetHandler(CommandNotificationPreferencesReq)
	async preferences(response: CrowniclesPacket[], context: PacketContext): Promise<void> {
		const {
			row, created
		} = await AppNotificationPreferences.getOrCreate(context.keycloakId!);
		if (created || row.discordPending) {
			PacketUtils.requestDiscordNotificationPreferences({ keycloakId: row.keycloakId });
		}
		response.push(preferencesResponse(row));
	}

	@packetHandler(CommandNotificationPreferenceSetReq)
	async setPreference(response: CrowniclesPacket[], context: PacketContext, packet: CommandNotificationPreferenceSetReq): Promise<void> {
		if (!isNotificationType(packet.type) || typeof packet.enabled !== "boolean") {
			PacketUtils.pushInternalError(response, "Invalid notification preference");
			return;
		}
		await AppNotificationPreferences.set(context.keycloakId!, packet.type, packet.enabled);
		response.push(preferencesResponse((await AppNotificationPreferences.find(context.keycloakId!))!));
	}

	/** Discord's answer: fills the app's settings once, then tells the app if it changed them. */
	@packetHandler(DiscordNotificationPreferencesPacket)
	async seedFromDiscord(_response: CrowniclesPacket[], context: PacketContext, packet: DiscordNotificationPreferencesPacket): Promise<void> {
		if (!context.discord || typeof packet.keycloakId !== "string") {
			CrowniclesLogger.warn("Ignored notification settings not coming from Discord", { context });
			return;
		}
		const preferences = validPreferences(packet.preferences);
		if (!await AppNotificationPreferences.seedFromDiscord(packet.keycloakId, preferences) || !preferences) {
			return;
		}
		PacketUtils.sendPackets({
			frontEndOrigin: "discord",
			frontEndSubOrigin: "system",
			keycloakId: packet.keycloakId,
			webSocket: {}
		}, [preferencesResponse((await AppNotificationPreferences.find(packet.keycloakId))!)]);
	}
}
