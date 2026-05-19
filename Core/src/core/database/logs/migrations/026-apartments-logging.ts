/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("apartment_purchases", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		price: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("apartment_purchases", ["playerId"]);
	await context.addIndex("apartment_purchases", ["cityId"]);
	await context.addIndex("apartment_purchases", ["date"]);

	await context.createTable("apartment_rent_claims", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		apartmentId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		rentClaimed: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("apartment_rent_claims", ["playerId"]);
	await context.addIndex("apartment_rent_claims", ["apartmentId"]);
	await context.addIndex("apartment_rent_claims", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("apartment_rent_claims");
	await context.dropTable("apartment_purchases");
}
