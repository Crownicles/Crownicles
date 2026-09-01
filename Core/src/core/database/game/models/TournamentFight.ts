import {
	DataTypes, Model, Sequelize
} from "sequelize";

export class TournamentFight extends Model {
	declare readonly id: number;

	declare tournamentId: number;

	declare attackerParticipantId: number;

	declare defenderParticipantId: number;

	declare winnerParticipantId: number | null;

	declare draw: boolean;

	declare playedAt: Date;

	declare createdAt: Date;

	declare updatedAt: Date;
}

export function initModel(sequelize: Sequelize): void {
	TournamentFight.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		tournamentId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		attackerParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		defenderParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		winnerParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		draw: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		playedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	}, {
		sequelize,
		tableName: "tournament_fights",
		freezeTableName: true
	});
}

export default TournamentFight;