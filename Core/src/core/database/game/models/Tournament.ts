import {
	DataTypes, Model, Sequelize
} from "sequelize";
import {
	LockKey, withLockedEntities
} from "../../../../../../Lib/src/locks/withLockedEntities";
import { TournamentStatus } from "../../../../../../Lib/src/types/Tournament";

export class Tournament extends Model {
	declare readonly id: number;

	declare discordGuildId: string;

	declare discordChannelId: string;

	declare createdByKeycloakId: string;

	declare status: TournamentStatus;

	declare pausedFromStatus: TournamentStatus | null;

	declare registrationEndsAt: Date;

	declare combatEndsAt: Date;

	declare pausedRemainingMs: number | null;

	declare startedNotificationSent: boolean;

	declare endingNotificationSent: boolean;

	declare endedNotificationSent: boolean;

	declare rewardsDistributed: boolean;

	declare cancellationReason: string | null;

	declare createdAt: Date;

	declare updatedAt: Date;

	static lockKey(id: number): LockKey<Tournament> {
		return {
			model: Tournament,
			id
		};
	}

	static withLocked<R>(id: number, fn: (tournament: Tournament) => Promise<R>): Promise<R> {
		return withLockedEntities([Tournament.lockKey(id)], ([tournament]) => fn(tournament));
	}
}

export function initModel(sequelize: Sequelize): void {
	Tournament.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		discordGuildId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		discordChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		createdByKeycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		status: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		pausedFromStatus: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: true
		},
		registrationEndsAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		combatEndsAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		pausedRemainingMs: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		startedNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		endingNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		endedNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		rewardsDistributed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		cancellationReason: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: true
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
		tableName: "tournaments",
		freezeTableName: true
	});
}

export default Tournament;
