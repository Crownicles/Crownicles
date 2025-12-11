import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("classical_shop_buyouts", "amount", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false,
		defaultValue: 1
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("classical_shop_buyouts", "amount");
}
