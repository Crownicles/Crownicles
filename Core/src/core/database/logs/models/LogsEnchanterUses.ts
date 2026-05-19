/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsEnchanterUses extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly itemCategory: number;

	declare readonly slot: number;

	declare readonly enchantmentId: string;

	declare readonly enchantmentType: string;

	declare readonly moneyPrice: number;

	declare readonly gemsPrice: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsEnchanterUses.init({
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
		enchantmentId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		enchantmentType: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		moneyPrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		gemsPrice: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "enchanter_uses",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
