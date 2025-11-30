import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "petExpeditionEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "petExpeditionSendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "petExpeditionChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "petExpeditionEnabled");
	await context.removeColumn("notifications", "petExpeditionSendType");
	await context.removeColumn("notifications", "petExpeditionChannelId");
}
