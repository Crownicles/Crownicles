import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add rewardIndex column to logs.expeditions table to store the reward index used for rewards calculation
	await context.addColumn("expeditions", "rewardIndex", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false,
		defaultValue: 0
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("expeditions", "rewardIndex");
}
