import {
	DataTypes, Model, Sequelize
} from "sequelize";

export const PVE_FIGHT_WINNER = {
	DRAW: 0,
	PLAYER: 1,
	MONSTER: 2
} as const;

export type PveFightWinner = typeof PVE_FIGHT_WINNER[keyof typeof PVE_FIGHT_WINNER];

export class LogsPveFightsResults extends Model {
	declare readonly id: number;

	declare readonly playerId: number;

	declare readonly classId: number | null;

	// Level of the player when the opponent level was chosen, null for the fights logged before it was recorded
	declare readonly playerLevel: number | null;

	declare readonly monsterId: string;

	declare readonly monsterLevel: number;

	declare readonly monsterFightPoints: number;

	declare readonly monsterAttack: number;

	declare readonly monsterDefense: number;

	declare readonly monsterSpeed: number;

	declare readonly turn: number;

	declare readonly winner: PveFightWinner;

	declare readonly date: number;
}

export function initModel(sequelize: Sequelize): void {
	LogsPveFightsResults.init({
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
			allowNull: true
		},
		playerLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		monsterId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		monsterLevel: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		monsterFightPoints: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		monsterAttack: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		monsterDefense: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		monsterSpeed: {
			type: DataTypes.INTEGER,
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
		tableName: "pve_fights_results",
		freezeTableName: true,
		timestamps: false
	});
}
