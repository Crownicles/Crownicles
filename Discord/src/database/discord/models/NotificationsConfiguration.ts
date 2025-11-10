import {
	DataTypes, Model, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export class NotificationsConfiguration extends Model {
	declare readonly discordId: string;

	declare reportEnabled: boolean;

	declare reportSendType: number;

	declare reportChannelId?: string;

	declare guildDailyEnabled: boolean;

	declare guildDailySendType: number;

	declare guildDailyChannelId?: string;

	declare guildKickEnabled: boolean;

	declare guildKickSendType: number;

	declare guildKickChannelId?: string;

	declare guildStatusChangeEnabled: boolean;

	declare guildStatusChangeSendType: number;

	declare guildStatusChangeChannelId?: string;

	declare playerFreedFromJailEnabled: boolean;

	declare playerFreedFromJailSendType: number;

	declare playerFreedFromJailChannelId?: string;

	declare fightChallengeEnabled: boolean;

	declare fightChallengeSendType: number;

	declare fightChallengeChannelId?: string;

	declare energyEnabled: boolean;

	declare energySendType: number;

	declare energyChannelId?: string;

	declare dailyBonusEnabled: boolean;

	declare dailyBonusSendType: number;

	declare dailyBonusChannelId?: string;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class NotificationsConfigurations {
	static async getOrRegister(discordId: string): Promise<NotificationsConfiguration> {
		return (await NotificationsConfiguration.findOrCreate(
			{ where: { discordId } }
		))[0]; // We don't care about the boolean that findOrCreate returns, so we strip it there
	}
}

export function initModel(sequelize: Sequelize): void {
	NotificationsConfiguration.init({
		discordId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			primaryKey: true
		},
		reportEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		reportSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		reportChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		guildDailyEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		guildDailySendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		guildDailyChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		guildKickEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		guildKickSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		guildKickChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		guildStatusChangeEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		guildStatusChangeSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		guildStatusChangeChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		playerFreedFromJailEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		playerFreedFromJailSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		playerFreedFromJailChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		fightChallengeEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		fightChallengeSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		fightChallengeChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		energyEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		energySendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		energyChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
		},
		dailyBonusEnabled: {
			type: DataTypes.BOOLEAN,
			defaultValue: true
		},
		dailyBonusSendType: {
			type: DataTypes.INTEGER,
			defaultValue: NotificationSendTypeEnum.DM
		},
		dailyBonusChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32)
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
		tableName: "notifications",
		freezeTableName: true
	});

	NotificationsConfiguration.beforeSave(instance => {
		instance.updatedAt = new Date();
	});
}

export default NotificationsConfiguration;
