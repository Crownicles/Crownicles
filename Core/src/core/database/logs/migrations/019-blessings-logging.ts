/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("blessings", {
		blessingType: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		action: {
			type: DataTypes.STRING(20),
			allowNull: false
		},
		triggeredByPlayerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		poolThreshold: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		durationHours: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("blessings", ["action"]);
	await context.addIndex("blessings", ["blessingType"]);

	await context.createTable("blessings_contributions", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		amount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		newPoolAmount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("blessings_contributions", ["playerId"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("blessings_contributions");
	await context.dropTable("blessings");
}
