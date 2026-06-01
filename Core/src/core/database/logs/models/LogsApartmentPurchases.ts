/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsApartmentPurchases extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly price: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsApartmentPurchases.init({
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
	}, {
		sequelize,
		tableName: "apartment_purchases",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
