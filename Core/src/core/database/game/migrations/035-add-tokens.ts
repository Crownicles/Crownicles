import {
	DataTypes, QueryInterface
} from "sequelize";

const INITIAL_TOKENS = 10;

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "tokens", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	await context.sequelize.query(`UPDATE players SET tokens = ${INITIAL_TOKENS}`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "tokens");
}
