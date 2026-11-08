import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("player_cooking_specialties", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		recipeId: {
			type: DataTypes.STRING(64), // eslint-disable-line new-cap
			allowNull: false,
			primaryKey: true
		}
	});
	await context.addConstraint("player_cooking_specialties", {
		fields: ["playerId"],
		type: "foreign key",
		name: "fk_player_cooking_specialties_playerId",
		references: {
			table: "players", field: "id"
		},
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("player_cooking_specialties");
}
