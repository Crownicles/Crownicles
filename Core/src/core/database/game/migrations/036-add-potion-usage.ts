import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("inventory_slots", "usagesPotionAiFight", {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("inventory_slots", "usagesPotionAiFight");
}