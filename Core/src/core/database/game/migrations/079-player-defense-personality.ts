import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Personality of the AI defending the player in PvP fights, null means a random one at each fight
	await context.addColumn("players", "defensePersonality", {
		type: DataTypes.STRING(32), // eslint-disable-line new-cap
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "defensePersonality");
}
