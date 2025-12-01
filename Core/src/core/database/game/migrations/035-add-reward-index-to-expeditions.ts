import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Add rewardIndex column to pet_expeditions table
	 * This stores the reward index calculated at expedition start for consistent reward calculation
	 */
	await context.addColumn("pet_expeditions", "rewardIndex", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Remove rewardIndex column from pet_expeditions
	await context.removeColumn("pet_expeditions", "rewardIndex");
}
