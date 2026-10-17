/* eslint-disable new-cap */
import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGuildDomainUpgrades extends Model {
	declare readonly playerId: number;

	declare readonly guildId: number;

	declare readonly cityId: string;

	declare readonly building: string;

	declare readonly newLevel: number;

	declare readonly cost: number;

	declare readonly xpGained: number;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildDomainUpgrades.init({
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
		building: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		newLevel: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		xpGained: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "guild_domain_upgrades",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
