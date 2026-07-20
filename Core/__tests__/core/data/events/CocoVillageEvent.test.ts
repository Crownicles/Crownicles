import {
	describe, expect, it
} from "vitest";
import cocoVillageEvent from "../../../../resources/events/50.json";

describe("Coco Village event", () => {
	it("forces every leave outcome to continue travelling", () => {
		const leaveOutcomes = Object.values(cocoVillageEvent.possibilities.leave.outcomes);

		expect(leaveOutcomes.every(outcome => outcome.forceLeaveCity)).toBe(true);
	});
});