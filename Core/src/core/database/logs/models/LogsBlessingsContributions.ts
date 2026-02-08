import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsBlessingsContributions extends Model {
	declare readonly playerId: number;

	declare readonly amount: number;

	declare readonly newPoolAmount: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsBlessingsContributions.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		amount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		newPoolAmount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "blessings_contributions",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
