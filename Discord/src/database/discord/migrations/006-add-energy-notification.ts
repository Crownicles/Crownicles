import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "energyEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "energySendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "energyChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "energyEnabled");
	await context.removeColumn("notifications", "energySendType");
	await context.removeColumn("notifications", "energyChannelId");
}
