/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsCityVisits extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly enterDate: number;

	declare readonly exitDate: number | null;

	declare readonly exitReason: number;

	declare readonly menusOpenedMask: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsCityVisits.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		enterDate: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		exitDate: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		exitReason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		menusOpenedMask: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		}
	}, {
		sequelize,
		tableName: "city_visits",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
