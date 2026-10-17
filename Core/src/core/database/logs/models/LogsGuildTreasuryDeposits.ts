import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class LogsGuildTreasuryDeposits extends Model {
	declare readonly playerId: number;

	declare readonly guildId: number;

	declare readonly grossAmount: number;

	declare readonly treasuryDeposited: number;

	declare readonly penalty: number;

	declare readonly isReimburse: boolean;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsGuildTreasuryDeposits.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		guildId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		grossAmount: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		treasuryDeposited: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		penalty: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		isReimburse: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "guild_treasury_deposits",
		freezeTableName: true,
		timestamps: false
	}).removeAttribute("id");
}
