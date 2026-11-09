import { PlayerMissionsInfo } from "../database/game/models/PlayerMissionsInfo";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";
import { CampaignData } from "../../data/Campaign";
import {
	OnboardingConstants, OnboardingMissionId
} from "../../../../Lib/src/constants/OnboardingConstants";

/** The contest mission the player is on, or null once the contest is over. */
export function currentOnboardingMission(missionInfo: PlayerMissionsInfo): OnboardingMissionId | null {
	const progression = missionInfo.campaignProgression;
	if (progression < 1 || progression > OnboardingConstants.CAMPAIGN_LENGTH) {
		return null;
	}
	return CampaignData.getMissions()[progression - 1].missionId as OnboardingMissionId;
}

/** A teaching stop is useless when the player already holds what it would hand over. */
const STILL_NEEDED: Partial<Record<OnboardingMissionId, (objects: PlayerActiveObjects) => boolean>> = {
	drinkPotion: objects => objects.potion.item.id === 0
};

/** The small event that teaches the current contest mission, if the player still needs it. */
export function teachingSmallEvent(missionInfo: PlayerMissionsInfo, objects: PlayerActiveObjects): string | null {
	const mission = currentOnboardingMission(missionInfo);
	if (!mission) {
		return null;
	}
	const key = OnboardingConstants.TEACHING_SMALL_EVENTS[mission];
	if (!key || STILL_NEEDED[mission]?.(objects) === false) {
		return null;
	}
	return key;
}

export function hiddenSmallEvents(missionInfo: PlayerMissionsInfo): readonly string[] {
	return currentOnboardingMission(missionInfo) ? OnboardingConstants.HIDDEN_SMALL_EVENTS : [];
}
