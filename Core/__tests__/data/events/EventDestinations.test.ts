import {
	describe, expect, it
} from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";

const RESOURCES_DIRECTORY = resolve(__dirname, "../../../resources");

type Outcome = {
	goBackToPreviousMap?: boolean;
	mapTypesDestination?: string[];
	mapTypesExcludeDestination?: string[];
};

type BigEvent = {
	triggers?: { mapId?: number }[];
	possibilities: Record<string, { outcomes: Record<string, Outcome> }>;
};

function readJsonFiles<T>(directory: string): Map<number, T> {
	const files = readdirSync(resolve(RESOURCES_DIRECTORY, directory)).filter(file => file.endsWith(".json"));
	return new Map(files.map(file => [parseInt(file, 10), JSON.parse(readFileSync(resolve(RESOURCES_DIRECTORY, directory, file), "utf8")) as T]));
}

describe("Big event destinations", () => {
	it("should only send the player to a map type connected to the map where the event happens", () => {
		const mapTypes = new Map([...readJsonFiles<{ type: string }>("mapLocations")].map(([id, location]) => [id, location.type]));
		const neighbours = new Map<number, number[]>();
		for (const link of readJsonFiles<{ startMap: number; endMap: number }>("mapLinks").values()) {
			neighbours.set(link.startMap, [...neighbours.get(link.startMap) ?? [], link.endMap]);
		}

		const unreachable: string[] = [];
		for (const [eventId, event] of readJsonFiles<BigEvent>("events")) {
			const eventMaps = (event.triggers ?? []).flatMap(trigger => (trigger.mapId === undefined ? [] : [trigger.mapId]));
			for (const [possibilityName, possibility] of Object.entries(event.possibilities)) {
				for (const [outcomeId, outcome] of Object.entries(possibility.outcomes)) {
					if (!outcome.mapTypesDestination && !outcome.mapTypesExcludeDestination) {
						continue;
					}
					for (const mapId of eventMaps) {
						const reachable = (neighbours.get(mapId) ?? []).some(neighbour => {
							const type = mapTypes.get(neighbour) ?? "";
							return (outcome.mapTypesDestination?.includes(type) ?? true)
								&& !(outcome.mapTypesExcludeDestination?.includes(type) ?? false);
						});
						if (!reachable) {
							unreachable.push(`${eventId}.${possibilityName}.${outcomeId} (map ${mapId})`);
						}
					}
				}
			}
		}

		expect(unreachable).toEqual([]);
	});

	// The U-turn is impossible towards a city or through a one way link: the outcome then needs a destination, or the choice would vanish (#4844)
	it("should give every go back outcome a destination to use when the U-turn is impossible", () => {
		const withoutFallback = [...readJsonFiles<BigEvent>("events")].flatMap(([eventId, event]) => Object.entries(event.possibilities)
			.flatMap(([possibilityName, possibility]) => Object.entries(possibility.outcomes)
				.filter(([, outcome]) => outcome.goBackToPreviousMap && !outcome.mapTypesDestination)
				.map(([outcomeId]) => `${eventId}.${possibilityName}.${outcomeId}`)));

		expect(withoutFallback).toEqual([]);
	});
});
