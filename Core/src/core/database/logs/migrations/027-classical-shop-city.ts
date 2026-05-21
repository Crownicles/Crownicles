/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("classical_shop_buyouts", "cityId", {
		type: DataTypes.STRING(32),
		allowNull: true
	});
	await context.addIndex("classical_shop_buyouts", ["cityId"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("classical_shop_buyouts", ["cityId"]);
	await context.removeColumn("classical_shop_buyouts", "cityId");
}
