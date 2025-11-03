import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMission(context, 26);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 26);
}
