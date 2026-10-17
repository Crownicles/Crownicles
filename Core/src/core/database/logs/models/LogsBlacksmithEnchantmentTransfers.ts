/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsBlacksmithEnchantmentTransfers extends Model {
	declare readonly playerId: number;

	declare readonly cityId: string;

	declare readonly itemCategory: number;

	declare readonly sourceSlot: number;

	declare readonly targetSlot: number;

	declare readonly enchantmentId: string;

	declare readonly cost: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsBlacksmithEnchantmentTransfers.init({
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
		sourceSlot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		targetSlot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		enchantmentId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "blacksmith_enchantment_transfers",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
