import MissionSlot, { MissionSlots } from "../database/game/models/MissionSlot";
import { MissionsController } from "./MissionsController";
import Player from "../database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { crowniclesInstance } from "../../index";
import { CampaignData } from "../../data/Campaign";
import {
	CompletedMission, MissionType
} from "../../../../Lib/src/types/CompletedMission";

export class Campaign {
	private static maxCampaignCache = -1;

	/**
	 * Get the maximum number of campaign missions
	 */
	static getMaxCampaignNumber(): number {
		if (this.maxCampaignCache === -1) {
			this.maxCampaignCache = CampaignData.getMissions().length;
		}
		return this.maxCampaignCache;
	}

	/**
	 * Check if the given campaign blob has a next mission to complete
	 * @param campaignBlob
	 */
	static hasNextCampaign(campaignBlob: string): boolean {
		return campaignBlob.includes("0");
	}

	/**
	 * Find the next campaign index to complete in the given campaign blob
	 * @param campaignBlob
	 */
	static findNextCampaignIndex(campaignBlob: string): number {
		return campaignBlob.indexOf("0");
	}

	public static async completeCampaignMissions(player: Player, missionInfo: PlayerMissionsInfo, completedCampaign: boolean, campaign: MissionSlot): Promise<CompletedMission[]> {
		const completedMissions: CompletedMission[] = [];
		let firstMissionChecked = false;
		while (campaign.isCompleted()) {
			if (completedCampaign || firstMissionChecked) {
				completedMissions.push({
					...campaign.toJSON(),
					missionType: MissionType.CAMPAIGN,
					pointsToWin: 0 // Campaign doesn't give points
				});
				missionInfo.campaignBlob = `${missionInfo.campaignBlob.slice(0, missionInfo.campaignProgression - 1)}1${missionInfo.campaignBlob.slice(missionInfo.campaignProgression)}`;
				missionInfo.campaignProgression = this.hasNextCampaign(missionInfo.campaignBlob) ? this.findNextCampaignIndex(missionInfo.campaignBlob) + 1 : 0;
				crowniclesInstance.logsDatabase.logMissionCampaignProgress(player.keycloakId, missionInfo.campaignProgression)
					.then();
			}
			if (!this.hasNextCampaign(missionInfo.campaignBlob)) {
				break;
			}
			const prop = CampaignData.getMissions()[missionInfo.campaignProgression - 1];
			Object.assign(campaign, {
				...campaign,
				missionVariant: prop.missionVariant,
				gemsToWin: prop.gemsToWin,
				xpToWin: prop.xpToWin,
				numberDone: await MissionsController.getMissionInterface(prop.missionId).initialNumberDone(player, prop.missionVariant) as number,
				missionId: prop.missionId,
				missionObjective: prop.missionObjective,
				moneyToWin: prop.moneyToWin,
				saveBlob: null
			});
			firstMissionChecked = true;
		}
		if (completedMissions.length !== 0 || !completedCampaign) {
			await Promise.all([campaign.save(), missionInfo.save()]);
		}
		return completedMissions;
	}

	public static async updatePlayerCampaign(completedCampaign: boolean, player: Player): Promise<CompletedMission[]> {
		const campaign = await MissionSlots.getCampaignOfPlayer(player.id);
		const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		if (completedCampaign || Campaign.hasNextCampaign(missionsInfo.campaignBlob)) {
			return await this.completeCampaignMissions(player, missionsInfo, completedCampaign, campaign);
		}
		return [];
	}

	/**
	 * Get the default campaign blob
	 */
	static getDefaultCampaignBlob(): string {
		return "0".repeat(this.getMaxCampaignNumber());
	}

	/**
	 * Get the amount of missions completed in the given campaign blob
	 * @param campaignBlob
	 */
	static getAmountOfCampaignCompleted(campaignBlob: string): number {
		return campaignBlob.split("1").length - 1;
	}
}
