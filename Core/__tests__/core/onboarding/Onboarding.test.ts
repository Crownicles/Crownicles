import {
	describe, expect, it
} from "vitest";
import { existsSync } from "fs";
import { CampaignData } from "../../../src/data/Campaign";
import {
	OnboardingConstants, ONBOARDING_TRIALS
} from "../../../../Lib/src/constants/OnboardingConstants";
import {
	currentOnboardingMission, hiddenSmallEvents, teachingSmallEvent
} from "../../../src/core/onboarding/OnboardingSmallEvents";
import { PlayerMissionsInfo } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerActiveObjects } from "../../../src/core/database/game/models/PlayerActiveObjects";

function atPosition(campaignProgression: number): PlayerMissionsInfo {
	return { campaignProgression } as PlayerMissionsInfo;
}

function carrying(potionId: number): PlayerActiveObjects {
	return { potion: { item: { id: potionId } } } as PlayerActiveObjects;
}

function positionOf(missionId: string): number {
	return CampaignData.getMissions().findIndex(mission => mission.missionId === missionId) + 1;
}

describe("royal contest onboarding", () => {
	it("follows the first campaign missions, in their order", () => {
		const trialMissions = ONBOARDING_TRIALS.flatMap(trial => trial.missions);
		expect(CampaignData.getMissions().slice(0, trialMissions.length).map(mission => mission.missionId)).toEqual(trialMissions);
		expect(OnboardingConstants.CAMPAIGN_LENGTH).toBe(trialMissions.length);
	});

	it("is over once the class is chosen, and for a completed campaign", () => {
		expect(currentOnboardingMission(atPosition(1))).toBe("commandReport");
		expect(currentOnboardingMission(atPosition(OnboardingConstants.CAMPAIGN_LENGTH))).toBe("chooseClass");
		expect(currentOnboardingMission(atPosition(OnboardingConstants.CAMPAIGN_LENGTH + 1))).toBeNull();
		expect(currentOnboardingMission(atPosition(0))).toBeNull();
	});

	it("puts an item on the road of a newcomer who must find one", () => {
		expect(teachingSmallEvent(atPosition(positionOf("findOrBuyItem")), carrying(0))).toBe("findItem");
	});

	it("hands a potion over only to a newcomer who has none to drink", () => {
		const drinking = atPosition(positionOf("drinkPotion"));
		expect(teachingSmallEvent(drinking, carrying(0))).toBe("findPotion");
		expect(teachingSmallEvent(drinking, carrying(12))).toBeNull();
	});

	it("leaves the road to chance on missions no stop teaches", () => {
		expect(teachingSmallEvent(atPosition(positionOf("visitCityNpc")), carrying(0))).toBeNull();
		expect(teachingSmallEvent(atPosition(OnboardingConstants.CAMPAIGN_LENGTH + 1), carrying(0))).toBeNull();
	});

	it("keeps small events about closed parts of the game away from newcomers only", () => {
		expect(hiddenSmallEvents(atPosition(4))).toEqual(OnboardingConstants.HIDDEN_SMALL_EVENTS);
		expect(hiddenSmallEvents(atPosition(4))).toContain("bigBad");
		expect(hiddenSmallEvents(atPosition(OnboardingConstants.CAMPAIGN_LENGTH + 1))).toEqual([]);
	});

	it("only names small events that exist", () => {
		const keys = [...OnboardingConstants.HIDDEN_SMALL_EVENTS, ...Object.values(OnboardingConstants.TEACHING_SMALL_EVENTS)];
		for (const key of keys) {
			expect(existsSync(`resources/smallEvents/${key}.json`), key).toBe(true);
		}
	});
});
