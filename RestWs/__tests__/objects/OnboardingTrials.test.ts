import {
	describe, expect, it
} from "vitest";
import {
	OnboardingConstants, ONBOARDING_TRIALS as CORE_TRIALS
} from "../../../Lib/src/constants/OnboardingConstants";
import {
	ONBOARDING_TRIALS, ROYAL_LETTERS
} from "../../../WsPackets/src/objects/Onboarding";

describe("royal contest shown by the app", () => {
	it("draws the trials Core runs", () => {
		expect(ONBOARDING_TRIALS).toEqual(CORE_TRIALS);
	});

	it("counts the letters Core sends", () => {
		expect(ROYAL_LETTERS).toBe(OnboardingConstants.ROYAL_MAIL.LETTERS);
	});
});
