import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsGuildsExperiences extends Model {
	declare readonly guildId: number;

	declare readonly experience: number;

	declare readonly reason: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildsExperiences.init({
		guildId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		experience: {
			type: DataTypes.INTEGER,
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
		tableName: "guilds_experiences",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}