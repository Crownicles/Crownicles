import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Hidden rating of a player against the king guards, null until its first fight against one
	await context.addColumn("players", "guardGloryPoints", {
		type: DataTypes.INTEGER,
		allowNull: true
	});

	// Rating and record of each guard of the library (Core/resources/kingGuards/library.json), filled when the bot starts
	await context.createTable("king_guards", {
		id: {
			type: DataTypes.SMALLINT.UNSIGNED,
			primaryKey: true
		},
		glory: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		wins: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		losses: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		draws: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("king_guards");
	await context.removeColumn("players", "guardGloryPoints");
}
