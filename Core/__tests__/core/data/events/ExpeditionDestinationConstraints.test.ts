import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import type Player from "../../../../src/core/database/game/models/Player";
import { CityDataController } from "../../../../src/data/City";
import { getMapTypesDestinationLink } from "../../../../src/data/events/PossibilityOutcome";

type EventOutcome = {
	excludeCityDestination?: boolean;
	mapTypesDestination?: string[];
};

type EventData = {
	possibilities: Record<string, {
		outcomes: Record<string, EventOutcome>;
	}>;
};

const eventsPath = resolve(__dirname, "../../../../resources/events");

function readEvent(eventId: number): EventData {
	return JSON.parse(readFileSync(resolve(eventsPath, `${eventId}.json`), "utf-8")) as EventData;
}

describe("Expedition destination constraints", () => {
	it("excludes cities instead of forcing the road type", () => {
		const forcedOutcomes = [
			[13, "goAway", "0"],
			[13, "goAway", "1"],
			[36, "goAway", "0"],
			[39, "convoy", "0"],
			[39, "convoy", "1"],
			[39, "convoy", "2"],
			[39, "convoy", "3"]
		] as const;

		for (const [eventId, possibilityId, outcomeId] of forcedOutcomes) {
			const outcome = readEvent(eventId).possibilities[possibilityId].outcomes[outcomeId];

			expect(outcome.excludeCityDestination).toBe(true);
			expect(outcome.mapTypesDestination).toBeUndefined();
		}
	});

	it("returns a non-city destination from Boug-Coton", () => {
		const player = {
			getDestinationId: (): number => 6,
			getPreviousMapId: (): number => 26
		} as Player;

		const destinationLink = getMapTypesDestinationLink({
			excludeCityDestination: true
		}, player);

		expect(CityDataController.instance.getCityByMapId(destinationLink.endMap)).toBeUndefined();
		expect([5, 7]).toContain(destinationLink.endMap);
	});
});
