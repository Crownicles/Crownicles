/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("city_visits", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: "players",
				key: "id"
			},
			onUpdate: "CASCADE",
			onDelete: "CASCADE"
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		enterDate: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		exitDate: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		exitReason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		menusOpenedMask: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		}
	});
	await context.addIndex("city_visits", ["playerId"]);
	await context.addIndex("city_visits", ["cityId"]);
	await context.addIndex("city_visits", ["enterDate"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("city_visits");
}
