import {
	DataTypes, Model, Sequelize
} from "sequelize";
import {
	LockKey, withLockedEntities
} from "../../../../../../Lib/src/locks/withLockedEntities";

export class TournamentCode extends Model {
	declare readonly id: number;

	declare codeHash: string;

	declare discordGuildId: string;

	declare expiresAt: Date;

	declare consumedAt: Date | null;

	declare createdAt: Date;

	declare updatedAt: Date;

	static lockKey(id: number): LockKey<TournamentCode> {
		return {
			model: TournamentCode,
			id
		};
	}

	static withLocked<R>(id: number, fn: (code: TournamentCode) => Promise<R>): Promise<R> {
		return withLockedEntities([TournamentCode.lockKey(id)], ([code]) => fn(code));
	}
}

export function initModel(sequelize: Sequelize): void {
	TournamentCode.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		codeHash: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false,
			unique: true
		},
		discordGuildId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		consumedAt: {
			type: DataTypes.DATE,
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
		tableName: "tournament_codes",
		freezeTableName: true
	});
}

export default TournamentCode;
