import {
	describe, expect, it
} from "vitest";
import giftEvent from "../../../../resources/events/34.json";
import coconutEvent from "../../../../resources/events/50.json";

describe("Coco Village events", () => {
	it("forces gift outcomes that resume travelling to leave the city", () => {
		const travellingOutcomes = [
			giftEvent.possibilities.end.outcomes[1],
			giftEvent.possibilities.end.outcomes[2],
			giftEvent.possibilities.food.outcomes[2],
			giftEvent.possibilities.health.outcomes[2],
			giftEvent.possibilities.kind.outcomes[0]
		];

		expect(travellingOutcomes.every(outcome => outcome.forceLeaveCity)).toBe(true);
	});

	it("forces every coconut outcome that resumes travelling to leave the city", () => {
		const travellingOutcomes = [
			...Object.values(coconutEvent.possibilities.ask.outcomes),
			...Object.values(coconutEvent.possibilities.end.outcomes),
			...Object.values(coconutEvent.possibilities.leave.outcomes),
			coconutEvent.possibilities.nap.outcomes[1],
			coconutEvent.possibilities.nap.outcomes[2]
		];

		expect(travellingOutcomes.every(outcome => outcome.forceLeaveCity)).toBe(true);
	});
});