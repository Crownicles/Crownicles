import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("settings", "dataNumber", {
		type: DataTypes.BIGINT,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.changeColumn("settings", "dataNumber", {
		type: DataTypes.BIGINT,
		allowNull: false
	});
}
