import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "dailyBonusEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "dailyBonusSendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "dailyBonusChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "dailyBonusEnabled");
	await context.removeColumn("notifications", "dailyBonusSendType");
	await context.removeColumn("notifications", "dailyBonusChannelId");
}
