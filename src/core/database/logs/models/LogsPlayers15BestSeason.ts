import {DataTypes, Model, Sequelize} from "sequelize";

export class LogsPlayers15BestSeason extends Model {
	public readonly playerId!: number;

	public readonly position!: number;

	public readonly seasonGlory!: number;

	public readonly date!: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPlayers15BestSeason.init({
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		position: {
			type: DataTypes.TINYINT,
			allowNull: false
		},
		seasonGlory: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "players_15_best_season",
		freezeTableName: true,
		timestamps: false
	});

	LogsPlayers15BestSeason.removeAttribute("id");
}