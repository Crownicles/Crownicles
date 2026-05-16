import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "furnaceOverheatUntil");
	await context.removeColumn("players", "furnaceLastUseDate");
	await context.removeColumn("players", "furnaceUsesToday");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
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
}
