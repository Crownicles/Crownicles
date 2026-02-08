/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsBlessings extends Model {
	declare readonly blessingType: number;

	declare readonly action: string;

	declare readonly triggeredByPlayerId: number | null;

	declare readonly poolThreshold: number;

	declare readonly durationHours: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsBlessings.init({
		blessingType: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		action: {
			type: DataTypes.STRING(20),
			allowNull: false
		},
		triggeredByPlayerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		poolThreshold: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		durationHours: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "blessings",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
