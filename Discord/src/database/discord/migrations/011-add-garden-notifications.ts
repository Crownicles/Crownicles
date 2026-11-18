import {
	DataTypes, QueryInterface
} from "sequelize";
import { NotificationSendTypeEnum } from "../../../notifications/NotificationSendType";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("notifications", "gardenPlantReadyEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: false
	});
	await context.addColumn("notifications", "gardenPlantReadySendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "gardenPlantReadyChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
	await context.addColumn("notifications", "gardenAllPlantsReadyEnabled", {
		type: DataTypes.BOOLEAN,
		defaultValue: true
	});
	await context.addColumn("notifications", "gardenAllPlantsReadySendType", {
		type: DataTypes.INTEGER,
		defaultValue: NotificationSendTypeEnum.DM
	});
	await context.addColumn("notifications", "gardenAllPlantsReadyChannelId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(32)
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("notifications", "gardenPlantReadyEnabled");
	await context.removeColumn("notifications", "gardenPlantReadySendType");
	await context.removeColumn("notifications", "gardenPlantReadyChannelId");
	await context.removeColumn("notifications", "gardenAllPlantsReadyEnabled");
	await context.removeColumn("notifications", "gardenAllPlantsReadySendType");
	await context.removeColumn("notifications", "gardenAllPlantsReadyChannelId");
}
