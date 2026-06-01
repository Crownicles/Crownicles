/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("guild_domain_purchases", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		fromCityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		},
		isRelocation: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("guild_domain_purchases", ["playerId"]);
	await context.addIndex("guild_domain_purchases", ["guildId"]);
	await context.addIndex("guild_domain_purchases", ["cityId"]);
	await context.addIndex("guild_domain_purchases", ["date"]);

	await context.createTable("guild_domain_upgrades", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		building: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		newLevel: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		xpGained: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("guild_domain_upgrades", ["playerId"]);
	await context.addIndex("guild_domain_upgrades", ["guildId"]);
	await context.addIndex("guild_domain_upgrades", ["cityId"]);
	await context.addIndex("guild_domain_upgrades", ["date"]);

	await context.createTable("guild_treasury_deposits", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		grossAmount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		treasuryDeposited: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		penalty: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		isReimburse: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("guild_treasury_deposits", ["playerId"]);
	await context.addIndex("guild_treasury_deposits", ["guildId"]);
	await context.addIndex("guild_treasury_deposits", ["date"]);

	await context.createTable("guild_food_shop_buys", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		},
		foodType: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		amount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		unitPrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		totalCost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("guild_food_shop_buys", ["playerId"]);
	await context.addIndex("guild_food_shop_buys", ["guildId"]);
	await context.addIndex("guild_food_shop_buys", ["cityId"]);
	await context.addIndex("guild_food_shop_buys", ["foodType"]);
	await context.addIndex("guild_food_shop_buys", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("guild_food_shop_buys");
	await context.dropTable("guild_treasury_deposits");
	await context.dropTable("guild_domain_upgrades");
	await context.dropTable("guild_domain_purchases");
}
