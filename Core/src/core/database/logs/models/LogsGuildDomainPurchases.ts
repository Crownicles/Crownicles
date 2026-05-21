/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGuildDomainPurchases extends Model {
	declare readonly playerId: number;

	declare readonly guildId: number;

	declare readonly cityId: string;

	declare readonly fromCityId: string | null;

	declare readonly isRelocation: boolean;

	declare readonly cost: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildDomainPurchases.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		fromCityId: {
			type: DataTypes.STRING(32),
			allowNull: true
		},
		isRelocation: {
			type: DataTypes.BOOLEAN,
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
		tableName: "guild_domain_purchases",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
