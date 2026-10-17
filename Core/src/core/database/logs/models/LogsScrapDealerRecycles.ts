/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsScrapDealerRecycles extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly itemCategory: number;

	declare readonly itemId: number;

	declare readonly itemLevel: number;

	declare readonly slot: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsScrapDealerRecycles.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		itemId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		itemLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "scrap_dealer_recycles",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
