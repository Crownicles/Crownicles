import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../index";

export async function resolvePlayerName(keycloakId?: string): Promise<string | null> {
	if (!keycloakId) {
		return null;
	}
	const result = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	if (result.isError) {
		return null;
	}
	return result.payload.user.attributes?.gameUsername?.[0] ?? result.payload.user.username;
}
