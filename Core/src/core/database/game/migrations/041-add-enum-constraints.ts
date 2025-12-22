import { QueryInterface } from "sequelize";

/**
 * Add ENUM constraints to status and locationType columns in pet_expeditions table.
 * This enforces data integrity at the database level for these string columns.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
	const sequelize = queryInterface.sequelize;

	// Convert status column to ENUM
	await sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed', 'recalled', 'cancelled') NOT NULL DEFAULT 'in_progress'
	`);

	// Convert locationType column to ENUM
	await sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN locationType ENUM('forest', 'mountain', 'desert', 'swamp', 'ruins', 'cave', 'plains', 'coast') NOT NULL
	`);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
	const sequelize = queryInterface.sequelize;

	// Revert status column back to VARCHAR
	await sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'in_progress'
	`);

	// Revert locationType column back to VARCHAR
	await sequelize.query(`
		ALTER TABLE pet_expeditions
		MODIFY COLUMN locationType VARCHAR(32) NOT NULL
	`);
}
