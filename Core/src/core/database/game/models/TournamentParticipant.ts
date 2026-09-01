import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { LockKey } from "../../../../../../Lib/src/locks/withLockedEntities";
import { TournamentCategory } from "../../../../../../Lib/src/types/Tournament";

export class TournamentParticipant extends Model {
	declare readonly id: number;

	declare tournamentId: number;

	declare playerId: number;

	declare keycloakId: string;

	declare category: TournamentCategory;

	declare lateRegistration: boolean;

	declare normalLeagueId: number;

	declare attackGloryPoints: number;

	declare defenseGloryPoints: number;

	declare finalRank: number | null;

	declare isWinner: boolean;

	declare rewardXp: number;

	declare rewardMoney: number;

	declare rewardItemCount: number;

	declare rewardGrantedAt: Date | null;

	declare registeredAt: Date;

	declare createdAt: Date;

	declare updatedAt: Date;

	static lockKey(id: number): LockKey<TournamentParticipant> {
		return {
			model: TournamentParticipant,
			id
		};
	}

	getTotalGloryPoints(): number {
		return this.attackGloryPoints + this.defenseGloryPoints;
	}
}

export function initModel(sequelize: Sequelize): void {
	TournamentParticipant.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		tournamentId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		category: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		lateRegistration: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		normalLeagueId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		attackGloryPoints: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		defenseGloryPoints: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		finalRank: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		isWinner: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		rewardXp: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardMoney: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardItemCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardGrantedAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		registeredAt: {
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
		tableName: "tournament_participants",
		freezeTableName: true
	});
}

export default TournamentParticipant;
