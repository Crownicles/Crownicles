/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsHomeUpgrades extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly fromLevel: number;

	declare readonly toLevel: number;

	declare readonly price: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsHomeUpgrades.init({
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
	}, {
		sequelize,
		tableName: "home_upgrades",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
