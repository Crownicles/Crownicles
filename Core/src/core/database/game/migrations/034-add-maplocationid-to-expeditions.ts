import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add mapLocationId column to pet_expeditions table
	await context.addColumn("pet_expeditions", "mapLocationId", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 1
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Remove mapLocationId column from pet_expeditions
	await context.removeColumn("pet_expeditions", "mapLocationId");
}
