import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { CampaignData } from "../../../src/data/Campaign";
import {
	OnboardingConstants, ONBOARDING_TRIALS
} from "../../../../Lib/src/constants/OnboardingConstants";
import Player from "../../../src/core/database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { reportExperience } from "../../../src/core/onboarding/OnboardingExperience";

const PLAYER = { id: 1 } as Player;
const CAP = OnboardingConstants.FIRST_TRIAL_MAX_REPORT_EXPERIENCE;

function atPosition(campaignProgression: number): void {
	vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ campaignProgression } as PlayerMissionsInfo);
}

describe("experience at the start of the contest", () => {
	afterEach(() => vi.restoreAllMocks());

	it("gives only a hint of experience from reports during the first trial", async () => {
		atPosition(ONBOARDING_TRIALS[0].missions.length);
		expect(await reportExperience(PLAYER, 120)).toBe(CAP);
		expect(await reportExperience(PLAYER, 8)).toBe(8);
	});

	it("gives full experience from the long road of the second trial on", async () => {
		atPosition(ONBOARDING_TRIALS[0].missions.length + 1);
		expect(await reportExperience(PLAYER, 120)).toBe(120);
		atPosition(0);
		expect(await reportExperience(PLAYER, 120)).toBe(120);
	});

	it("rewards the missions before the class choice with little experience", () => {
		const beforeClassChoice = CampaignData.getMissions().slice(0, OnboardingConstants.CAMPAIGN_LENGTH - 1);
		expect(beforeClassChoice.every(mission => mission.xpToWin <= CAP)).toBe(true);
	});
});
