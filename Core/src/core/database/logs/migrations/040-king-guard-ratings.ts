import {
	DataTypes, QueryInterface
} from "sequelize";

const TABLE = "king_guard_fights_results";

/*
 * Guard of the library fought (null for the guards generated on the fly before the library), and the hidden ratings
 * of the player and of the guard before the fight with their change
 */
const COLUMNS = {
	guardId: DataTypes.SMALLINT.UNSIGNED,
	playerGuardGlory: DataTypes.INTEGER,
	playerGuardGloryChange: DataTypes.SMALLINT,
	guardGlory: DataTypes.INTEGER,
	guardGloryChange: DataTypes.SMALLINT
};

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	for (const [column, type] of Object.entries(COLUMNS)) {
		await context.addColumn(TABLE, column, {
			type,
			allowNull: true
		});
	}
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	for (const column of Object.keys(COLUMNS)) {
		await context.removeColumn(TABLE, column);
	}
}
