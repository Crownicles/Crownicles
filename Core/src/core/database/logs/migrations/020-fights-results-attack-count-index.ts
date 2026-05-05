import { QueryInterface } from "sequelize";

/**
 * Safely add an index, ignoring duplicate key errors (ER_DUP_KEYNAME - 1061).
 */
async function safeAddIndex(context: QueryInterface, tableName: string, columns: string[], indexName: string): Promise<void> {
	try {
		await context.addIndex(tableName, columns, { name: indexName });
	}
	catch (error) {
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
 * Safely remove an index, ignoring "can't drop" errors.
 */
async function safeRemoveIndex(context: QueryInterface, tableName: string, indexName: string): Promise<void> {
	try {
		await context.removeIndex(tableName, indexName);
	}
	catch (error) {
		if (error instanceof Error && "original" in error) {
			const dbError = error as Error & { original?: { errno?: number } };
			if (dbError.original?.errno === 1091) {
				return;
			}
		}
		throw error;
	}
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Composite index to optimize the attacker K-factor inactivity query:
	 * SELECT COUNT(*) FROM fights_results WHERE fightInitiatorId = ? AND friendly = false AND date >= ?
	 */
	await safeAddIndex(
		context,
		"fights_results",
		[
			"fightInitiatorId",
			"friendly",
			"date"
		],
		"idx_fightInitiator_friendly_date"
	);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await safeRemoveIndex(context, "fights_results", "idx_fightInitiator_friendly_date");
}
