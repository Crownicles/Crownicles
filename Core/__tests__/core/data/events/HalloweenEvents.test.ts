import {
	describe, expect, it
} from "vitest";
import hauntedPathEvent from "../../../../resources/events/80.json";
import hauntedHouseEvent from "../../../../resources/events/81.json";
import hauntedPathLink from "../../../../resources/mapLinks/97.json";
import hauntedHouseToMirageLakeLink from "../../../../resources/mapLinks/98.json";
import hauntedHouseToWonderRoadLink from "../../../../resources/mapLinks/99.json";

describe("Halloween events", () => {
	it("uses the seasonal path to enter the haunted house", () => {
		expect(hauntedPathEvent.possibilities.followPath.outcomes["0"].mapLink).toBe(97);
		expect(hauntedPathEvent.possibilities.end.outcomes["0"].mapLink).toBe(97);
		expect(hauntedPathLink).toMatchObject({
			startMap: 39,
			endMap: 40,
			forcedImage: "halloween_map"
		});
	});

	it("uses the seasonal exits from the haunted house", () => {
		const mirageLakeOutcomes = [
			hauntedHouseEvent.possibilities.end.outcomes["0"],
			hauntedHouseEvent.possibilities.randomRoom.outcomes["4"],
			hauntedHouseEvent.possibilities.visitBasement.outcomes["2"],
			hauntedHouseEvent.possibilities.visitLobby.outcomes["4"]
		];
		const wonderRoadOutcomes = [
			hauntedHouseEvent.possibilities.randomRoom.outcomes["3"],
			hauntedHouseEvent.possibilities.visitBasement.outcomes["1"],
			hauntedHouseEvent.possibilities.visitLobby.outcomes["3"]
		];

		expect(mirageLakeOutcomes.every(outcome => outcome.mapLink === 98)).toBe(true);
		expect(wonderRoadOutcomes.every(outcome => outcome.mapLink === 99)).toBe(true);
		expect(hauntedHouseToMirageLakeLink).toMatchObject({ startMap: 40, endMap: 14 });
		expect(hauntedHouseToWonderRoadLink).toMatchObject({ startMap: 40, endMap: 21 });
	});
});