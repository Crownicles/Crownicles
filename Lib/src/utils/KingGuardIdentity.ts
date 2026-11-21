import { FightConstants } from "../constants/FightConstants";

/**
 * A king guard has no account: the identifier sent in place of its keycloak id carries the id of the guard in the library,
 * so that the fronts can name it
 */
export abstract class KingGuardIdentity {
	/**
	 * Identifier sent in place of the keycloak id of a king guard
	 * @param guardId - Id of the guard in the library
	 */
	static toKeycloakId(guardId: number): string {
		return `${FightConstants.KING_GUARD.KEYCLOAK_ID_PREFIX}${guardId}`;
	}

	/**
	 * Id of the king guard behind an identifier, null when it is the keycloak id of a player
	 * @param keycloakId
	 */
	static getGuardId(keycloakId: string | null | undefined): number | null {
		const prefix = FightConstants.KING_GUARD.KEYCLOAK_ID_PREFIX;
		if (!keycloakId?.startsWith(prefix)) {
			return null;
		}
		const guardId = Number(keycloakId.substring(prefix.length));
		return Number.isInteger(guardId) && guardId > 0 ? guardId : null;
	}
}
