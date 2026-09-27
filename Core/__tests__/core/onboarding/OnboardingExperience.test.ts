import {
	describe, expect, it
} from "vitest";
import { CampaignData } from "../../../src/data/Campaign";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import Player from "../../../src/core/database/game/models/Player";
import { MapLocation } from "../../../src/data/MapLocation";
import { reportExperience } from "../../../src/core/onboarding/OnboardingExperience";

const CAP = OnboardingConstants.KING_CASTLE_MAX_REPORT_EXPERIENCE;

function headingTo(attribute: string | null): Player {
	return { getDestination: (): MapLocation | null => (attribute === null ? null : { attribute } as MapLocation) } as Player;
}

describe("experience at the start of the adventure", () => {
	it("gives only a hint of experience from reports inside the king's castle", () => {
		const newcomer = headingTo(MapConstants.MAP_ATTRIBUTES.KING_CASTLE);
		expect(reportExperience(newcomer, 287)).toBe(CAP);
		expect(reportExperience(newcomer, 8)).toBe(8);
	});

	it("gives full experience from the road to a first city on", () => {
		expect(reportExperience(headingTo(MapConstants.MAP_ATTRIBUTES.CONTINENT1), 287)).toBe(287);
		expect(reportExperience(headingTo(null), 287)).toBe(287);
	});

	it("rewards the missions before the class choice with little experience", () => {
		const beforeClassChoice = CampaignData.getMissions().slice(0, OnboardingConstants.CAMPAIGN_LENGTH - 1);
		expect(beforeClassChoice.every(mission => mission.xpToWin <= CAP)).toBe(true);
	});
});
