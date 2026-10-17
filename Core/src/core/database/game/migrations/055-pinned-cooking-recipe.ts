import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "pinnedCookingRecipeId", {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "pinnedCookingRecipeId");
}
