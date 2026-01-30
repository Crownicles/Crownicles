import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class ScheduledExpeditionNotification extends Model {
	declare readonly expeditionId: number;

	declare readonly keycloakId: string;

	declare readonly petId: number;

	declare readonly petSex: string;

	declare readonly petNickname?: string;

	declare readonly scheduledAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

/**
 * Parameters for scheduling an expedition notification
 */
export interface ScheduleNotificationParams {
	expeditionId: number;
	keycloakId: string;
	petId: number;
	petSex: string;
	petNickname?: string;
	scheduledAt: Date;
}

export abstract class ScheduledExpeditionNotifications {
	static async scheduleNotification(params: ScheduleNotificationParams): Promise<void> {
		await ScheduledExpeditionNotification.upsert({ ...params });
	}

	static async getNotificationsBeforeDate(date: Date): Promise<ScheduledExpeditionNotification[]> {
		return await ScheduledExpeditionNotification.findAll({
			where: {
				scheduledAt: { [Op.lt]: date }
			}
		});
	}

	static async bulkDelete(notifications: ScheduledExpeditionNotification[]): Promise<void> {
		await ScheduledExpeditionNotification.destroy({
			where: {
				expeditionId: {
					[Op.in]: notifications.map(notification => notification.expeditionId)
				}
			}
		});
	}

	static async deleteByExpeditionId(expeditionId: number): Promise<void> {
		await ScheduledExpeditionNotification.destroy({
			where: { expeditionId }
		});
	}

	static async getPendingNotification(expeditionId: number): Promise<ScheduledExpeditionNotification | null> {
		return await ScheduledExpeditionNotification.findOne({
			where: { expeditionId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	ScheduledExpeditionNotification.init({
		expeditionId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petSex: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(1),
			allowNull: false
		},
		petNickname: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: true
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
		tableName: "scheduled_expedition_notifications",
		freezeTableName: true
	});
}
