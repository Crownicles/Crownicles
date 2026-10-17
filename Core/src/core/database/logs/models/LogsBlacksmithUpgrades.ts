/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsBlacksmithUpgrades extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly itemCategory: number;

	declare readonly slot: number;

	declare readonly fromLevel: number;

	declare readonly toLevel: number;

	declare readonly totalCost: number;

	declare readonly boughtMaterials: boolean;

	declare readonly materialsCost: number | null;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsBlacksmithUpgrades.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		fromLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		toLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		totalCost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		boughtMaterials: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		materialsCost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "blacksmith_upgrades",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
