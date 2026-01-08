import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add wasStartedWhileTired column to pet_expeditions table
	await context.addColumn("pet_expeditions", "wasStartedWhileTired", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("pet_expeditions", "wasStartedWhileTired");
}
