import {
	DataTypes, Sequelize
} from "sequelize";
import {
	LogsShopBuyouts, logsShopLoggingAttributes
} from "./LogsShopBuyouts";

/* eslint-disable new-cap */

export class LogsMissionShopBuyouts extends LogsShopBuyouts {
	declare readonly cityId: string | null;
}

export function initModel(sequelize: Sequelize): void {
	LogsMissionShopBuyouts.init({
		...logsShopLoggingAttributes,
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		}
	}, {
		sequelize,
		tableName: "mission_shop_buyouts",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
