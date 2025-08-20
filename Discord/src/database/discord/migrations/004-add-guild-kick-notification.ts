import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "guildKickEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "guildKickSendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "guildKickChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "guildKickEnabled");
	await context.removeColumn("notifications", "guildKickSendType");
	await context.removeColumn("notifications", "guildKickChannelId");
}
