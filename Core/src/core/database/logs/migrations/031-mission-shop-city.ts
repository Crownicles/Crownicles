/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("mission_shop_buyouts", "cityId", {
		type: DataTypes.STRING(32),
		allowNull: true
	});
	await context.addIndex("mission_shop_buyouts", ["cityId"], {
		name: "idx_mission_shop_buyouts_cityId"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("mission_shop_buyouts", "idx_mission_shop_buyouts_cityId");
	await context.removeColumn("mission_shop_buyouts", "cityId");
}
