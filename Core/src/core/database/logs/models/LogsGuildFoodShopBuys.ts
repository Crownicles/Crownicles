/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGuildFoodShopBuys extends Model {
	declare readonly playerId: number;

	declare readonly guildId: number;

	declare readonly cityId: string | null;

	declare readonly foodType: string;

	declare readonly amount: number;

	declare readonly unitPrice: number;

	declare readonly totalCost: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildFoodShopBuys.init({
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
	}, {
		sequelize,
		tableName: "guild_food_shop_buys",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
