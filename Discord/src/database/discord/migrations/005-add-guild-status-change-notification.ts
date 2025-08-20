import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "guildStatusChangeEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "guildStatusChangeSendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "guildStatusChangeChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "guildStatusChangeEnabled");
	await context.removeColumn("notifications", "guildStatusChangeSendType");
	await context.removeColumn("notifications", "guildStatusChangeChannelId");
}
