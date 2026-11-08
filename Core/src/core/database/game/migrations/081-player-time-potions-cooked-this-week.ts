import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Time potions successfully cooked since the last weekly reset, capped by the weekly limit
	await context.addColumn("players", "timePotionsCookedThisWeek", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "timePotionsCookedThisWeek");
}
