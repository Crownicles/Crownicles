import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class ScheduledDailyBonusNotification extends Model {
	declare readonly playerId: number;

	declare readonly keycloakId: string;

	declare readonly scheduledAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class ScheduledDailyBonusNotifications {
	static async scheduleNotification(playerId: number, keycloakId: string, scheduledAt: Date): Promise<void> {
		await ScheduledDailyBonusNotification.upsert({
			playerId,
			keycloakId,
			scheduledAt
		});
	}

	static async getNotificationsBeforeDate(date: Date): Promise<ScheduledDailyBonusNotification[]> {
		return await ScheduledDailyBonusNotification.findAll({
			where: {
				scheduledAt: { [Op.lt]: date }
			}
		});
	}

	static async bulkDelete(notifications: ScheduledDailyBonusNotification[]): Promise<void> {
		await ScheduledDailyBonusNotification.destroy({
			where: {
				playerId: {
					[Op.in]: notifications.map(notification => notification.playerId)
				}
			}
		});
	}

	static async getPendingNotification(playerId: number): Promise<ScheduledDailyBonusNotification | null> {
		return await ScheduledDailyBonusNotification.findOne({
			where: { playerId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	ScheduledDailyBonusNotification.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
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
		tableName: "scheduled_daily_bonus_notifications",
		freezeTableName: true
	});
}
