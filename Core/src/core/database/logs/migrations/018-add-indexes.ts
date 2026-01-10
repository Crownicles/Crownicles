import { QueryInterface } from "sequelize";

/**
 * Safely add an index, ignoring duplicate key errors (ER_DUP_KEYNAME - 1061).
 * This makes the migration idempotent.
 */
async function safeAddIndex(context: QueryInterface, tableName: string, columns: string[], indexName: string): Promise<void> {
	try {
		await context.addIndex(tableName, columns, { name: indexName });
	}
	catch (error) {
		// Ignore duplicate key name error (index already exists)
		if (error instanceof Error && "original" in error) {
			const dbError = error as Error & { original?: { errno?: number } };
			if (dbError.original?.errno === 1061) {
				return;
			}
		}
		throw error;
	}
}

/**
 * Safely remove an index, ignoring "can't drop" errors (index doesn't exist).
 */
async function safeRemoveIndex(context: QueryInterface, tableName: string, indexName: string): Promise<void> {
	try {
		await context.removeIndex(tableName, indexName);
	}
	catch (error) {
		// Ignore "can't drop" errors (index doesn't exist)
		if (error instanceof Error && "original" in error) {
			const dbError = error as Error & { original?: { errno?: number } };
			// 1091 = Can't DROP; check that column/key exists
			if (dbError.original?.errno === 1091) {
				return;
			}
		}
		throw error;
	}
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// players_commands - most queried table (139 MB, 2.9M rows)
	await safeAddIndex(context, "players_commands", ["date"], "idx_date");
	await safeAddIndex(context, "players_commands", ["playerId", "date"], "idx_player_date");

	// players_money (67 MB, 1.7M rows)
	await safeAddIndex(context, "players_money", ["playerId", "date"], "idx_player_date");

	// players_small_events (57 MB, 1.6M rows)
	await safeAddIndex(context, "players_small_events", ["playerId", "date"], "idx_player_date");
	await safeAddIndex(context, "players_small_events", ["smallEventId", "date"], "idx_smallevent_date");

	// players_score (37 MB, 970K rows)
	await safeAddIndex(context, "players_score", ["playerId", "date"], "idx_player_date");

	// players_experience (36 MB, 930K rows)
	await safeAddIndex(context, "players_experience", ["playerId", "date"], "idx_player_date");

	// players_travels (27 MB, 727K rows)
	await safeAddIndex(context, "players_travels", ["playerId", "date"], "idx_player_date");
	await safeAddIndex(context, "players_travels", ["date"], "idx_date");

	// players_possibilities (25 MB, 677K rows)
	await safeAddIndex(context, "players_possibilities", ["playerId", "date"], "idx_player_date");

	// fights_actions_used (24 MB, 712K rows)
	await safeAddIndex(context, "fights_actions_used", ["fightId"], "idx_fight");

	// players_standard_alterations (20 MB, 527K rows)
	await safeAddIndex(context, "players_standard_alterations", ["playerId", "date"], "idx_player_date");

	// players_health (16 MB, 418K rows)
	await safeAddIndex(context, "players_health", ["playerId", "date"], "idx_player_date");

	// players_gems (9 MB, 224K rows)
	await safeAddIndex(context, "players_gems", ["playerId", "date"], "idx_player_date");

	// fights_results - for fight history queries
	await safeAddIndex(context, "fights_results", ["fightInitiatorId"], "idx_fightInitiator");
	await safeAddIndex(context, "fights_results", ["player2Id"], "idx_player2");
	await safeAddIndex(context, "fights_results", ["date"], "idx_date");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await safeRemoveIndex(context, "players_commands", "idx_date");
	await safeRemoveIndex(context, "players_commands", "idx_player_date");
	await safeRemoveIndex(context, "players_money", "idx_player_date");
	await safeRemoveIndex(context, "players_small_events", "idx_player_date");
	await safeRemoveIndex(context, "players_small_events", "idx_smallevent_date");
	await safeRemoveIndex(context, "players_score", "idx_player_date");
	await safeRemoveIndex(context, "players_experience", "idx_player_date");
	await safeRemoveIndex(context, "players_travels", "idx_player_date");
	await safeRemoveIndex(context, "players_travels", "idx_date");
	await safeRemoveIndex(context, "players_possibilities", "idx_player_date");
	await safeRemoveIndex(context, "fights_actions_used", "idx_fight");
	await safeRemoveIndex(context, "players_standard_alterations", "idx_player_date");
	await safeRemoveIndex(context, "players_health", "idx_player_date");
	await safeRemoveIndex(context, "players_gems", "idx_player_date");
	await safeRemoveIndex(context, "fights_results", "idx_fightInitiator");
	await safeRemoveIndex(context, "fights_results", "idx_player2");
	await safeRemoveIndex(context, "fights_results", "idx_date");
}
