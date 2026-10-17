/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsInnRooms extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly innId: string;

	declare readonly roomId: string;

	declare readonly price: number;

	declare readonly healthGained: number;

	declare readonly healthBefore: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsInnRooms.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		innId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		roomId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		price: {
			type: DataTypes.SMALLINT.UNSIGNED,
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
		tableName: "inn_rooms",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
