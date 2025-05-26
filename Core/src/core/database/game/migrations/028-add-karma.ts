import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "karma", DataTypes.INTEGER);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "karma");
}
