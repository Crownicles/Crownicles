import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "lastMealAt", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	await context.addColumn("inventory_slots", "itemLevel", {
		type: DataTypes.INTEGER,
		defaultValue: 0
	});

	await context.addColumn("inventory_slots", "itemEnchantmentId", {
		type: DataTypes.STRING,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "lastMealAt");
	await context.removeColumn("inventory_slots", "itemLevel");
	await context.removeColumn("inventory_slots", "itemEnchantmentId");
}
