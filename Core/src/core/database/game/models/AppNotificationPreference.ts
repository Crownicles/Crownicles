import {
	DataTypes, Model, ModelAttributeColumnOptions, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";
import {
	ALL_NOTIFICATION_TYPES, DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences, NotificationType
} from "../../../../../../Lib/src/types/NotificationPreferences";

/**
 * Which notifications a player wants in the app. Discord keeps its own settings: the two only meet
 * once, when this row is created and filled from Discord's.
 */
export class AppNotificationPreference extends Model {
	declare readonly keycloakId: string;

	/** Discord has not answered yet: its settings may still replace the defaults, until the player changes one. */
	declare discordPending: boolean;

	declare report: boolean;

	declare dailyBonus: boolean;

	declare energy: boolean;

	declare guildDaily: boolean;

	declare guildKick: boolean;

	declare guildStatusChange: boolean;

	declare playerFreedFromJail: boolean;

	declare fightChallenge: boolean;

	declare petExpedition: boolean;

	declare tournament: boolean;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export function preferencesOf(row: AppNotificationPreference): NotificationPreferences {
	return Object.fromEntries(ALL_NOTIFICATION_TYPES.map(type => [type, row[type]])) as NotificationPreferences;
}

export type AppNotificationPreferenceLookup = {
	row: AppNotificationPreference;
	created: boolean;
};

export abstract class AppNotificationPreferences {
	/** The player's settings, created from the defaults the first time; `created` tells when Discord must be asked. */
	static async getOrCreate(keycloakId: string): Promise<AppNotificationPreferenceLookup> {
		const [row, created] = await AppNotificationPreference.findOrCreate({
			where: { keycloakId },
			defaults: {
				keycloakId, discordPending: true, ...DEFAULT_NOTIFICATION_PREFERENCES
			}
		});
		return {
			row, created
		};
	}

	/** A choice made in the app is final: Discord's settings can no longer override any of them. */
	static async set(keycloakId: string, type: NotificationType, enabled: boolean): Promise<void> {
		await AppNotificationPreferences.getOrCreate(keycloakId);
		await AppNotificationPreference.update({
			[type]: enabled, discordPending: false
		}, { where: { keycloakId } });
	}

	/** Applies Discord's settings once, and only while the player has changed nothing in the app. */
	static async seedFromDiscord(keycloakId: string, preferences: NotificationPreferences | undefined): Promise<boolean> {
		const [updated] = await AppNotificationPreference.update(
			{
				...preferences ?? {}, discordPending: false
			},
			{ where: {
				keycloakId, discordPending: true
			} }
		);
		return updated > 0;
	}

	static async find(keycloakId: string): Promise<AppNotificationPreference | null> {
		return await AppNotificationPreference.findOne({ where: { keycloakId } });
	}
}

/** A new object each time: Sequelize writes the column name into the definition, so one shared object would merge them all. */
function preferenceColumn(): ModelAttributeColumnOptions {
	return {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true
	};
}

export function initModel(sequelize: Sequelize): void {
	AppNotificationPreference.init({
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			primaryKey: true
		},
		discordPending: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: true
		},
		...Object.fromEntries(ALL_NOTIFICATION_TYPES.map(type => [type, preferenceColumn()])),
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
		tableName: "app_notification_preferences",
		freezeTableName: true
	});
}

export default AppNotificationPreference;
