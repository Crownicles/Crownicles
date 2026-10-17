/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsCookingUses extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string | null;

	declare readonly recipeId: string;

	declare readonly recipeLevel: number;

	declare readonly outputType: string;

	declare readonly success: boolean;

	declare readonly bonus: boolean;

	declare readonly wasSecret: boolean;

	declare readonly xpGained: number;

	declare readonly levelUp: boolean;

	declare readonly potionId: number | null;

	declare readonly foodType: string | null;

	declare readonly foodStored: number | null;

	declare readonly foodSurplus: number | null;

	declare readonly materialOutputId: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsCookingUses.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		},
		recipeId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		recipeLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		outputType: {
			type: DataTypes.STRING(16),
			allowNull: false
		},
		success: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		bonus: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		wasSecret: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		xpGained: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		levelUp: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		potionId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		foodType: {
			type: DataTypes.STRING(16),
			allowNull: true
		},
		foodStored: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		foodSurplus: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		materialOutputId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "cooking_uses",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
