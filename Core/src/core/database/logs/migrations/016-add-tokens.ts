import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("players_tokens", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		value: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		reason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addColumn("expeditions", "tokens", {
		type: DataTypes.SMALLINT.UNSIGNED,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("expeditions", "tokens");
	await context.dropTable("players_tokens");
}
