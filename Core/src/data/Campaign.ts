import { readFileSync } from "fs";

export type CampaignMission = {
	missionId: string;
	missionVariant: number;
	missionObjective: number;
	gemsToWin: number;
	xpToWin: number;
	moneyToWin: number;
	petRewardTypeId?: number;
};

export class CampaignData {
	private static missions: CampaignMission[] | null = null;

	public static getMissions(): CampaignMission[] {
		if (!CampaignData.missions) {
			CampaignData.missions = JSON.parse(readFileSync("resources/campaign.json")
				.toString("utf8")).missions;
		}

		return CampaignData.missions!;
	}
}
