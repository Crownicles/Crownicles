import { LogsPlayers } from "./models/LogsPlayers";

/**
 * Find or create a player row in the logs database by keycloak ID.
 *
 * Centralises the lookup used by every logger so the
 * "empty keycloakId -> null" contract stays consistent.
 *
 * @returns The matching log player row, or `null` if `keycloakId` is empty.
 */
export async function findOrCreateLogsPlayer(keycloakId: string): Promise<LogsPlayers | null> {
	if (!keycloakId) {
		return null;
	}
	return (await LogsPlayers.findOrCreate({
		where: { keycloakId }
	}))[0];
}
