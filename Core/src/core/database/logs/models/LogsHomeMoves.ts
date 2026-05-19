/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsHomeMoves extends Model {
	declare readonly playerId: number;

	declare readonly fromCityId: string;

	declare readonly toCityId: string;

	declare readonly basePrice: number;

	declare readonly rentApplied: number;

	declare readonly effectivePrice: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsHomeMoves.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		fromCityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		toCityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		basePrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		rentApplied: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		effectivePrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "home_moves",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
