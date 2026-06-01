import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add cooking fields to players table
	await context.addColumn("players", "cookingLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	await context.addColumn("players", "cookingExperience", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	await context.addColumn("players", "furnaceUsesToday", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	await context.addColumn("players", "furnaceLastUseDate", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	await context.addColumn("players", "furnaceOverheatUntil", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	await context.addColumn("players", "furnacePosition", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	// Create player_cooking_recipes table
	await context.createTable("player_cooking_recipes", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true
		},
		recipeId: {
			type: DataTypes.STRING(64), // eslint-disable-line new-cap
			allowNull: false,
			primaryKey: true
		},
		sourceMapId: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: null
		}
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("player_cooking_recipes");
	await context.removeColumn("players", "furnacePosition");
	await context.removeColumn("players", "furnaceOverheatUntil");
	await context.removeColumn("players", "furnaceLastUseDate");
	await context.removeColumn("players", "furnaceUsesToday");
	await context.removeColumn("players", "cookingExperience");
	await context.removeColumn("players", "cookingLevel");
}
