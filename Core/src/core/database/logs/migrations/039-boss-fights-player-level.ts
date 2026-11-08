import {
	DataTypes, QueryInterface
} from "sequelize";

// Level of the player when the opponent level was chosen, to follow how far the bosses and king guards are from the players
const BOSS_FIGHTS_TABLES = ["pve_fights_results", "king_guard_fights_results"];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	for (const table of BOSS_FIGHTS_TABLES) {
		await context.addColumn(table, "playerLevel", {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		});
	}
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	for (const table of BOSS_FIGHTS_TABLES) {
		await context.removeColumn(table, "playerLevel");
	}
}
