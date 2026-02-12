import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../bot/CrowniclesShard";
import { escapeUsername } from "./StringUtils";

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
