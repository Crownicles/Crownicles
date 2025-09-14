import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class ScheduledEnergyNotification extends Model {
	declare readonly playerId: number;

	declare readonly keycloakId: string;

	declare readonly scheduledAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class ScheduledEnergyNotifications extends Model {
	static async scheduleNotification(playerId: number, keycloakId: string, scheduledAt: Date): Promise<void> {
		await ScheduledEnergyNotification.upsert({
			playerId,
			keycloakId,
			scheduledAt
		});
	}

	static async getNotificationsBeforeDate(date: Date): Promise<ScheduledEnergyNotification[]> {
		return await ScheduledEnergyNotification.findAll({
			where: {
				scheduledAt: {
					[Op.lt]: date
				}
			}
		});
	}

	static async bulkDelete(notifications: ScheduledEnergyNotification[]): Promise<void> {
		await ScheduledEnergyNotification.destroy({
			where: {
				playerId: {
					[Op.in]: notifications.map(notification => notification.playerId)
				}
			}
		});
	}

	static async getPendingNotification(playerId: number): Promise<ScheduledEnergyNotification | null> {
		return await ScheduledEnergyNotification.findOne({
			where: {
				playerId
			}
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	ScheduledEnergyNotification.init({
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
		tableName: "scheduled_energy_notifications",
		freezeTableName: true
	});
}
