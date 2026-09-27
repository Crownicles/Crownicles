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
import { PlayersConstants } from "../../../../Lib/src/constants/PlayersConstants";
import { hidesTokenOffer } from "../../../src/core/onboarding/OnboardingTokens";

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

	it("hands a newcomer, who starts without any, their first token with the first mission only", () => {
		expect(PlayersConstants.PLAYER_DEFAULT_VALUES.TOKENS).toBe(0);
		const [first, ...others] = CampaignData.getMissions();
		expect(first).toMatchObject({ missionId: "commandMission", tokensToWin: 1 });
		expect(others.filter(mission => mission.tokensToWin)).toEqual([]);
	});

	it("never leads a newcomer to the token merchant, only to tokens they can spend", () => {
		expect(hidesTokenOffer(atPosition(1), false)).toBe(true);
		expect(hidesTokenOffer(atPosition(2), true)).toBe(false);
		expect(hidesTokenOffer(atPosition(OnboardingConstants.CAMPAIGN_LENGTH + 1), false)).toBe(false);
		expect(hidesTokenOffer(atPosition(0), false)).toBe(false);
	});

	it("is over once the class is chosen, and for a completed campaign", () => {
		expect(currentOnboardingMission(atPosition(1))).toBe("commandMission");
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
