import { QueryInterface } from "sequelize";
<<<<<<< HEAD:Core/src/core/database/game/migrations/042-add-enum-constraints.ts
=======
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

// Error codes for table not found
const TABLE_NOT_FOUND_ERRNO = 1146;

/**
 * Safely execute a query, ignoring table not found errors
 */
async function safeQuery(context: QueryInterface, sql: string): Promise<void> {
	try {
		await context.sequelize.query(sql);
	}
	catch (e) {
		const errno = (e as { original?: { errno?: number } }).original?.errno;
		if (errno !== TABLE_NOT_FOUND_ERRNO) {
			throw e;
		}
		CrowniclesLogger.debug(`Migration 042: Ignoring error ${errno} for query: ${sql.substring(0, 100)}...`);

		// Table doesn't exist - skip
	}
}
>>>>>>> 057d9a2f8 (fix(migrations): correct typos and renumber migrations 036-042):Core/src/core/database/game/migrations/041-add-enum-constraints.ts

/**
 * Add ENUM constraints to status and locationType columns in pet_expeditions table.
 * This enforces data integrity at the database level for these string columns.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Convert status column to ENUM
	await context.sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'recalled', 'cancelled') NOT NULL DEFAULT 'in_progress'
	`);

	// Convert locationType column to ENUM
	await context.sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN locationType ENUM('forest', 'mountain', 'desert', 'swamp', 'ruins', 'cave', 'plains', 'coast') NOT NULL
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Revert status column back to VARCHAR
	await context.sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'in_progress'
	`);

	// Revert locationType column back to VARCHAR
	await context.sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN locationType VARCHAR(32) NOT NULL
	`);
}
