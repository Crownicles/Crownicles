import {
	DataTypes, Sequelize
} from "sequelize";
import {
	LogsShopBuyouts, logsShopLoggingAttributes
} from "./LogsShopBuyouts";

export class LogsClassicalShopBuyouts extends LogsShopBuyouts {
	declare readonly amount: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsClassicalShopBuyouts.init({
		...logsShopLoggingAttributes,
		amount: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false,
			defaultValue: 1
		}
	}, {
		sequelize,
		tableName: "classical_shop_buyouts",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
