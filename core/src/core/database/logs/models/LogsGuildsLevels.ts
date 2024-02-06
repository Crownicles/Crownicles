import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsGuildsLevels extends Model {
	declare readonly guildId: number;

	declare readonly level: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildsLevels.init({
		guildId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		level: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "guilds_levels",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}