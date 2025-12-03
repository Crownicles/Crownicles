import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add meetVelanna mission at position 26 (after chooseClassTier with variant 1)
	await addCampaignMission(context, 26);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 26);
}
