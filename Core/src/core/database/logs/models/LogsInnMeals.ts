/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsInnMeals extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly innId: string;

	declare readonly mealId: string;

	declare readonly price: number;

	declare readonly energyGained: number;

	declare readonly energyBefore: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsInnMeals.init({
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
		mealId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		price: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		energyGained: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		energyBefore: {
			type: DataTypes.SMALLINT,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "inn_meals",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
