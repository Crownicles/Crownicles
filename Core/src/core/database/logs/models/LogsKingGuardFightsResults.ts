import {
	DataTypes, Model, Sequelize
} from "sequelize";

export const KING_GUARD_FIGHT_WINNER = {
	DRAW: 0,
	PLAYER: 1,
	GUARD: 2
} as const;

export type KingGuardFightWinner = typeof KING_GUARD_FIGHT_WINNER[keyof typeof KING_GUARD_FIGHT_WINNER];

export class LogsKingGuardFightsResults extends Model {
	declare readonly id: number;

	declare readonly playerId: number;

	declare readonly classId: number;

	declare readonly guardClassId: number;

	declare readonly guardLevel: number;

	declare readonly turn: number;

	declare readonly winner: KingGuardFightWinner;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsKingGuardFightsResults.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		classId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		guardClassId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		guardLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		turn: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		winner: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "king_guard_fights_results",
		freezeTableName: true,
		timestamps: false
	});
}
