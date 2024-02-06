import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsGuildsJoins extends Model {
	declare readonly guildId: number;

	declare readonly adderId: number;

	declare readonly addedId: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildsJoins.init({
		guildId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		adderId: DataTypes.INTEGER,
		addedId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "guilds_joins",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}