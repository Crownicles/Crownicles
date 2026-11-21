import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";

export const GARDEN_NOTIFICATION_TYPES = {
	PLANT_READY: "plantReady",
	ALL_PLANTS_READY: "allPlantsReady"
} as const;

export type GardenNotificationType = typeof GARDEN_NOTIFICATION_TYPES[keyof typeof GARDEN_NOTIFICATION_TYPES];

export class ScheduledGardenNotification extends Model {
	declare readonly playerId: number;

	declare readonly type: GardenNotificationType;

	declare readonly keycloakId: string;

	declare readonly scheduledAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export abstract class ScheduledGardenNotifications {
	static async scheduleNotification(params: {
		playerId: number;
		type: GardenNotificationType;
		keycloakId: string;
		scheduledAt: Date;
	}): Promise<void> {
		await ScheduledGardenNotification.upsert({ ...params });
	}

	static async deleteNotification(playerId: number, type: GardenNotificationType): Promise<void> {
		await ScheduledGardenNotification.destroy({
			where: {
				playerId, type
			}
		});
	}

	static async deleteOfPlayer(playerId: number): Promise<void> {
		await ScheduledGardenNotification.destroy({
			where: { playerId }
		});
	}

	static async getNotificationsBeforeDate(date: Date): Promise<ScheduledGardenNotification[]> {
		return await ScheduledGardenNotification.findAll({
			where: {
				scheduledAt: { [Op.lte]: date }
			}
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	ScheduledGardenNotification.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		type: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
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
		tableName: "scheduled_garden_notifications",
		freezeTableName: true
	});
}
