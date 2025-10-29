import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("player_missions_info", "dailyMissionBlob", {
		type: DataTypes.BLOB,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_missions_info", "dailyMissionBlob");
}
