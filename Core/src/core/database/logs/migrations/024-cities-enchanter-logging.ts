/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("enchanter_uses", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		enchantmentId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		enchantmentType: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		moneyPrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		gemsPrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("enchanter_uses", ["playerId"]);
	await context.addIndex("enchanter_uses", ["cityId"]);
	await context.addIndex("enchanter_uses", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("enchanter_uses");
}
