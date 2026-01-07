import { QueryInterface } from "sequelize";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

// Error codes
const TABLE_NOT_FOUND_ERRNO = 1146;
const KEY_COLUMN_DOES_NOT_EXIST_ERRNO = 1072;
const DUPLICATE_KEY_ERRNO = 1061;
const INDEX_NOT_FOUND_ERRNO = 1091;

const IGNORABLE_ADD_INDEX_ERRNOS = [
	TABLE_NOT_FOUND_ERRNO,
	KEY_COLUMN_DOES_NOT_EXIST_ERRNO,
	DUPLICATE_KEY_ERRNO
];
const IGNORABLE_REMOVE_INDEX_ERRNOS = [TABLE_NOT_FOUND_ERRNO, INDEX_NOT_FOUND_ERRNO];

/**
 * Safely add an index, ignoring errors if table/column doesn't exist or index already exists
 */
async function safeAddIndex(context: QueryInterface, tableName: string, columns: string[], options: { name: string }): Promise<void> {
	try {
		await context.addIndex(tableName, columns, options);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (!IGNORABLE_ADD_INDEX_ERRNOS.includes(errno!)) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 018: Ignoring error ${errno} for addIndex ${options.name} on ${tableName}`);

		// Table/column doesn't exist or index already exists - skip
	}
}

/**
 * Safely remove an index, ignoring errors if table/index doesn't exist
 */
async function safeRemoveIndex(context: QueryInterface, tableName: string, indexName: string): Promise<void> {
	try {
		await context.removeIndex(tableName, indexName);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (!IGNORABLE_REMOVE_INDEX_ERRNOS.includes(errno!)) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 018: Ignoring error ${errno} for removeIndex ${indexName} on ${tableName}`);

		// Table or index doesn't exist - skip
	}
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// players_commands - most queried table (139 MB, 2.9M rows)
	await safeAddIndex(context, "players_commands", ["date"], { name: "idx_date" });
	await safeAddIndex(context, "players_commands", ["playerId", "date"], { name: "idx_player_date" });

	// players_money (67 MB, 1.7M rows)
	await safeAddIndex(context, "players_money", ["playerId", "date"], { name: "idx_player_date" });

	// players_small_events (57 MB, 1.6M rows)
	await safeAddIndex(context, "players_small_events", ["playerId", "date"], { name: "idx_player_date" });
	await safeAddIndex(context, "players_small_events", ["smallEventId", "date"], { name: "idx_smallevent_date" });

	// players_score (37 MB, 970K rows)
	await safeAddIndex(context, "players_score", ["playerId", "date"], { name: "idx_player_date" });

	// players_experience (36 MB, 930K rows)
	await safeAddIndex(context, "players_experience", ["playerId", "date"], { name: "idx_player_date" });

	// players_travels (27 MB, 727K rows)
	await safeAddIndex(context, "players_travels", ["playerId", "date"], { name: "idx_player_date" });
	await safeAddIndex(context, "players_travels", ["date"], { name: "idx_date" });

	// players_possibilities (25 MB, 677K rows)
	await safeAddIndex(context, "players_possibilities", ["playerId", "date"], { name: "idx_player_date" });

	// fights_actions_used (24 MB, 712K rows)
	await safeAddIndex(context, "fights_actions_used", ["fightId"], { name: "idx_fight" });

	// players_standard_alterations (20 MB, 527K rows)
	await safeAddIndex(context, "players_standard_alterations", ["playerId", "date"], { name: "idx_player_date" });

	// players_health (16 MB, 418K rows)
	await safeAddIndex(context, "players_health", ["playerId", "date"], { name: "idx_player_date" });

	// players_gems (9 MB, 224K rows)
	await safeAddIndex(context, "players_gems", ["playerId", "date"], { name: "idx_player_date" });

	// fights_results - for fight history queries
	await safeAddIndex(context, "fights_results", ["player1Id"], { name: "idx_player1" });
	await safeAddIndex(context, "fights_results", ["player2Id"], { name: "idx_player2" });
	await safeAddIndex(context, "fights_results", ["date"], { name: "idx_date" });
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
	await safeRemoveIndex(context, "fights_results", "idx_player1");
	await safeRemoveIndex(context, "fights_results", "idx_player2");
	await safeRemoveIndex(context, "fights_results", "idx_date");
}
