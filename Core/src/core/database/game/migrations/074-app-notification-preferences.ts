import {
	DataTypes, QueryInterface
} from "sequelize";

/** Frozen here rather than read from Lib, so this migration keeps creating the same table if the types change. */
const NOTIFICATION_COLUMNS = [
	"report",
	"dailyBonus",
	"energy",
	"guildDaily",
	"guildKick",
	"guildStatusChange",
	"playerFreedFromJail",
	"fightChallenge",
	"petExpedition",
	"tournament"
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("app_notification_preferences", {
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
		...Object.fromEntries(NOTIFICATION_COLUMNS.map(column => [
			column, {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true
			}
		])),
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("app_notification_preferences");
}
