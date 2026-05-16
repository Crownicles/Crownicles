import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGuildsFoodsChanges extends Model {
	declare readonly guildId: number;

	declare readonly food: number;

	declare readonly total: number;

	declare readonly reason: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildsFoodsChanges.init({
		guildId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		food: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		total: {
			type: DataTypes.MEDIUMINT.UNSIGNED,
			allowNull: false
		},
		reason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "guilds_foods_changes",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
