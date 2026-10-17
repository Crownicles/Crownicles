import {
	DataTypes, Sequelize
} from "sequelize";
import {
	LogsShopBuyouts, logsShopLoggingAttributes
} from "./LogsShopBuyouts";

/* eslint-disable new-cap */

export class LogsClassicalShopBuyouts extends LogsShopBuyouts {
	declare readonly amount: number;

	declare readonly cityId: string | null;
}

export function initModel(sequelize: Sequelize): void {
	LogsClassicalShopBuyouts.init({
		...logsShopLoggingAttributes,
		amount: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false,
			defaultValue: 1
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		}
	}, {
		sequelize,
		tableName: "classical_shop_buyouts",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
