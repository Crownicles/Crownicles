/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("home_purchases", {
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
	await context.addIndex("home_purchases", ["playerId"]);
	await context.addIndex("home_purchases", ["cityId"]);
	await context.addIndex("home_purchases", ["date"]);

	await context.createTable("home_upgrades", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		fromLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		toLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
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
	await context.addIndex("home_upgrades", ["playerId"]);
	await context.addIndex("home_upgrades", ["cityId"]);
	await context.addIndex("home_upgrades", ["date"]);

	await context.createTable("home_moves", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		fromCityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		toCityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		basePrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		rentApplied: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		effectivePrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("home_moves", ["playerId"]);
	await context.addIndex("home_moves", ["fromCityId"]);
	await context.addIndex("home_moves", ["toCityId"]);
	await context.addIndex("home_moves", ["date"]);

	await context.createTable("home_bed_uses", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
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
	await context.addIndex("home_bed_uses", ["playerId"]);
	await context.addIndex("home_bed_uses", ["cityId"]);
	await context.addIndex("home_bed_uses", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("home_bed_uses");
	await context.dropTable("home_moves");
	await context.dropTable("home_upgrades");
	await context.dropTable("home_purchases");
}
