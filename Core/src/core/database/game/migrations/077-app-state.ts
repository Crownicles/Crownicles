import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("player_missions_info", "appSeen", {
		type: DataTypes.INTEGER.UNSIGNED,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "pendingReveals", {
		type: DataTypes.TEXT,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_missions_info", "pendingReveals");
	await context.removeColumn("player_missions_info", "appSeen");
}
