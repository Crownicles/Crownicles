import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "lastGardenWatered", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
	await context.addColumn("player_talismans", "hasRemoteHarvestTalisman", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "lastGardenWatered");
	await context.removeColumn("player_talismans", "hasRemoteHarvestTalisman");
}
