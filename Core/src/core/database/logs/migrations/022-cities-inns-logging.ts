/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("inn_meals", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		innId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		mealId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		price: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		energyGained: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		energyBefore: {
			type: DataTypes.SMALLINT,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("inn_meals", ["playerId"]);
	await context.addIndex("inn_meals", [
		"cityId",
		"innId",
		"mealId"
	]);
	await context.addIndex("inn_meals", ["date"]);

	await context.createTable("inn_rooms", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		innId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		roomId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		price: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		healthGained: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		healthBefore: {
			type: DataTypes.SMALLINT,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("inn_rooms", ["playerId"]);
	await context.addIndex("inn_rooms", [
		"cityId",
		"innId",
		"roomId"
	]);
	await context.addIndex("inn_rooms", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("inn_rooms");
	await context.dropTable("inn_meals");
}
