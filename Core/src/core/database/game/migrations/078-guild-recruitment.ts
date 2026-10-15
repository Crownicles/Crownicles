import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("guilds", "recruitmentOfficeLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "recruitmentOpen", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
	await context.addColumn("guilds", "recruitmentMinScore", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("guilds", "recruitmentMinScore");
	await context.removeColumn("guilds", "recruitmentOpen");
	await context.removeColumn("guilds", "recruitmentOfficeLevel");
}
