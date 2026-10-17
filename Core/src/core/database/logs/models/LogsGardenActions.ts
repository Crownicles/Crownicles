/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGardenActions extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string | null;

	declare readonly action: number;

	declare readonly plantId: string;

	declare readonly slot: number;

	declare readonly cost: number;

	declare readonly quantity: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGardenActions.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		},
		action: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		plantId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		quantity: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "garden_actions",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
