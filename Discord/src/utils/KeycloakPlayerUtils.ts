import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import {
	crowniclesClient, keycloakConfig
} from "../bot/CrowniclesShard";
import { escapeUsername } from "./StringUtils";
import { User } from "discord.js";

/**
 * Resolve a keycloak ID to a player display name, with a fallback for unknown players
 */
export async function resolveKeycloakPlayerName(keycloakId: string | undefined | null, lng: Language): Promise<string> {
	if (!keycloakId) {
		return i18n.t("error:unknownPlayer", { lng });
	}
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	if (!getUser.isError && getUser.payload.user.attributes.gameUsername) {
		return escapeUsername(getUser.payload.user.attributes.gameUsername[0]);
	}
	return i18n.t("error:unknownPlayer", { lng });
}

/**
 * Resolve a keycloak ID to its Discord user (for avatar display), or null if it cannot be found
 */
export async function resolveKeycloakDiscordUser(keycloakId: string | undefined | null): Promise<User | null> {
	if (!keycloakId) {
		return null;
	}
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	if (getUser.isError) {
		return null;
	}
	const discordId = getUser.payload.user.attributes.discordId?.[0];
	if (!discordId || discordId === "0") {
		return null;
	}
	return crowniclesClient.users.cache.get(discordId) ?? await crowniclesClient.users.fetch(discordId).catch(() => null);
}
