import {
	NotificationsConfiguration
} from "../database/discord/models/NotificationsConfiguration";
import { discordPreferences } from "./NotificationType";
import {
	DiscordNotificationPreferencesRequest, NotificationPreferences
} from "../../../Lib/src/types/NotificationPreferences";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import {
	keycloakConfig, shardId
} from "../bot/CrowniclesShard";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordNotificationPreferencesPacket } from "../../../Lib/src/packets/commands/CommandNotificationPreferencesPacket";
import { PacketUtils } from "../utils/PacketUtils";
import { LANGUAGE } from "../../../Lib/src/Language";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

/** Finds the settings without creating a row: a player who never opened them on Discord has none to share. */
async function preferencesOfKeycloakUser(keycloakId: string): Promise<NotificationPreferences | undefined | null> {
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	if (getUser.isError) {
		return null;
	}
	const discordId = getUser.payload.user.attributes.discordId?.[0];
	if (!discordId || discordId === "0") {
		return undefined;
	}
	const configuration = await NotificationsConfiguration.findOne({ where: { discordId } });
	return configuration ? discordPreferences(configuration) : undefined;
}

/**
 * Answers Core with the player's Discord settings, so the app starts from them.
 * When Keycloak cannot tell, nothing is sent: Core asks again the next time the app reads its settings.
 */
export async function answerNotificationPreferencesRequest(payload: string): Promise<void> {
	const request = JSON.parse(payload) as DiscordNotificationPreferencesRequest;
	if (typeof request.keycloakId !== "string") {
		return;
	}
	const preferences = await preferencesOfKeycloakUser(request.keycloakId);
	if (preferences === null) {
		CrowniclesLogger.warn("Could not read the Discord notification settings of a player", { keycloakId: request.keycloakId });
		return;
	}
	const context: PacketContext = {
		frontEndOrigin: "discord",
		frontEndSubOrigin: "system",
		discord: {
			shardId,
			user: "",
			interaction: "",
			channel: "",
			language: LANGUAGE.ENGLISH
		}
	};
	PacketUtils.sendPacketToBackend(context, makePacket(DiscordNotificationPreferencesPacket, {
		keycloakId: request.keycloakId,
		...preferences ? { preferences } : {}
	}));
}
