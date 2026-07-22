import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class ScheduledReportNotification extends Model {
	declare readonly playerId: number;

	declare readonly keycloakId: string;

	declare readonly mapId: number;

	declare readonly scheduledAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export abstract class ScheduledReportNotifications {
	static async scheduleNotification(playerId: number, keycloakId: string, mapId: number, scheduledAt: Date): Promise<void> {
		await ScheduledReportNotification.upsert({
			playerId,
			keycloakId,
			mapId,
			scheduledAt
		});
	}

	static async getNotificationsBeforeDate(date: Date): Promise<ScheduledReportNotification[]> {
		return await ScheduledReportNotification.findAll({
			where: {
				scheduledAt: { [Op.lt]: date }
			}
		});
	}

	/**
	 * Atomically claim (delete) the scheduled notification of a player.
	 *
	 * The row acts as a single-use token: the DELETE is serialised by the
	 * database on the primary key, so exactly one of the concurrent callers
	 * (the periodic poller in {@link processDueReportNotifications} and the
	 * `Player.afterSave` hook) receives `true` and is allowed to dispatch the
	 * notification. Every other caller receives `false` and must stay silent.
	 * This is what prevents the duplicate arrival notification (issue #4562).
	 */
	static async claimNotification(playerId: number): Promise<boolean> {
		const deletedRows = await ScheduledReportNotification.destroy({
			where: { playerId }
		});
		return deletedRows > 0;
	}

	static async getPendingNotification(playerId: number): Promise<ScheduledReportNotification | null> {
		return await ScheduledReportNotification.findOne({
			where: { playerId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	ScheduledReportNotification.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		mapId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		scheduledAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "scheduled_report_notifications",
		freezeTableName: true
	});
}
