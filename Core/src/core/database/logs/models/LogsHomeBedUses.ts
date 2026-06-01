/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsHomeBedUses extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly healthGained: number;

	declare readonly healthBefore: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsHomeBedUses.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		healthGained: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		healthBefore: {
			type: DataTypes.SMALLINT,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "home_bed_uses",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
