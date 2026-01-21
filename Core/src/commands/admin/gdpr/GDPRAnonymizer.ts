import { createHash } from "crypto";

/**
 * Anonymization utilities for GDPR export
 * Used to consistently anonymize player IDs while keeping the exported player's data traceable
 */
export class GDPRAnonymizer {
	private readonly playerIdHash: string;

	private readonly keycloakIdHash: string;

	private readonly otherPlayersHashes: Map<number, string> = new Map();

	private otherPlayerCounter = 0;

	constructor(playerId: number, keycloakId: string) {
		// Create consistent hash for the player being exported
		this.playerIdHash = createHash("sha256").update(`player-${playerId}`)
			.digest("hex")
			.substring(0, 16);
		this.keycloakIdHash = createHash("sha256").update(`keycloak-${keycloakId}`)
			.digest("hex")
			.substring(0, 16);
	}

	/**
	 * Get the anonymized ID for the exported player
	 */
	getAnonymizedPlayerId(): string {
		return this.playerIdHash;
	}

	/**
	 * Anonymize a player ID - own ID gets consistent hash, other players get "OTHER_PLAYER_X"
	 */
	anonymizePlayerId(playerId: number | null, isOwnPlayer: boolean): string | null {
		if (playerId === null) {
			return null;
		}
		if (isOwnPlayer) {
			return this.playerIdHash;
		}
		if (!this.otherPlayersHashes.has(playerId)) {
			this.otherPlayerCounter++;
			this.otherPlayersHashes.set(playerId, `OTHER_PLAYER_${this.otherPlayerCounter}`);
		}
		return this.otherPlayersHashes.get(playerId)!;
	}

	/**
	 * Anonymize a keycloak ID
	 */
	anonymizeKeycloakId(keycloakId: string | null, isOwnPlayer: boolean): string | null {
		if (keycloakId === null) {
			return null;
		}
		if (isOwnPlayer) {
			return this.keycloakIdHash;
		}
		return "REDACTED";
	}

	/**
	 * Anonymize a guild ID
	 */
	anonymizeGuildId(guildId: number | null): string | null {
		if (guildId === null || guildId === 0) {
			return null;
		}
		return createHash("sha256").update(`guild-${guildId}`)
			.digest("hex")
			.substring(0, 12);
	}
}
