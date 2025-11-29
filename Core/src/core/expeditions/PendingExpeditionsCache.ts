import { ExpeditionData } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";

/**
 * Cache entry for pending expeditions
 */
interface PendingExpeditionEntry {
	expeditions: ExpeditionData[];
	timestamp: number;
}

/**
 * Cache cleanup interval (5 minutes)
 */
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Cache expiry time (10 minutes)
 */
const CACHE_EXPIRY_TIME = 10 * 60 * 1000;

/**
 * Cache for storing generated expeditions until the player makes a choice
 * Key: keycloakId, Value: { expeditions, timestamp }
 */
class PendingExpeditionsCacheClass {
	private cache = new Map<string, PendingExpeditionEntry>();

	constructor() {
		this.startCleanupInterval();
	}

	/**
	 * Store expeditions for a player
	 */
	set(keycloakId: string, expeditions: ExpeditionData[]): void {
		this.cache.set(keycloakId, {
			expeditions,
			timestamp: Date.now()
		});
	}

	/**
	 * Get expeditions for a player
	 */
	get(keycloakId: string): ExpeditionData[] | null {
		const entry = this.cache.get(keycloakId);
		if (!entry) {
			return null;
		}

		// Check if expired
		if (Date.now() - entry.timestamp > CACHE_EXPIRY_TIME) {
			this.cache.delete(keycloakId);
			return null;
		}

		return entry.expeditions;
	}

	/**
	 * Find a specific expedition by ID for a player
	 */
	findExpedition(keycloakId: string, expeditionId: string): ExpeditionData | null {
		const expeditions = this.get(keycloakId);
		if (!expeditions) {
			return null;
		}
		return expeditions.find(exp => exp.id === expeditionId) ?? null;
	}

	/**
	 * Remove expeditions for a player
	 */
	delete(keycloakId: string): void {
		this.cache.delete(keycloakId);
	}

	/**
	 * Check if a player has pending expeditions
	 */
	has(keycloakId: string): boolean {
		return this.get(keycloakId) !== null;
	}

	/**
	 * Start the cleanup interval
	 */
	private startCleanupInterval(): void {
		setInterval(() => {
			this.cleanupExpired();
		}, CACHE_CLEANUP_INTERVAL);
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanupExpired(): void {
		const now = Date.now();
		for (const [key, value] of this.cache.entries()) {
			if (now - value.timestamp > CACHE_EXPIRY_TIME) {
				this.cache.delete(key);
			}
		}
	}
}

export const PendingExpeditionsCache = new PendingExpeditionsCacheClass();
