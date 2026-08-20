import {
	describe, expect, it
} from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import hermitEvent from "../../../../resources/events/40.json";

type EventData = {
	possibilities?: {
		[key: string]: {
			condition?: { canGoBack?: boolean };
			outcomes: { [key: string]: { goBackToPreviousMap?: boolean } };
		};
	};
};

const eventsPath = resolve(__dirname, "../../../../resources/events");

function readEvents(): [string, EventData][] {
	return readdirSync(eventsPath)
		.filter(file => file.endsWith(".json"))
		.map(file => [file, JSON.parse(readFileSync(resolve(eventsPath, file), "utf-8")) as EventData]);
}

/*
 * Travelling backwards is normally forbidden, so a possibility offering it must be hidden when the
 * U-turn is impossible (`canGoBack`) and must actually perform it (`goBackToPreviousMap`). Declaring
 * only one of the two brings back #4559: a button promising a return that silently sends the player
 * to the opposite side of the map.
 */
describe("Go back outcomes", () => {
	const events = readEvents();

	it("gates every go back possibility behind the canGoBack condition", () => {
		const ungated = events.flatMap(([file, event]) => Object.entries(event.possibilities ?? {})
			.filter(([, possibility]) => Object.values(possibility.outcomes)
				.some(outcome => outcome.goBackToPreviousMap) && !possibility.condition?.canGoBack)
			.map(([name]) => `${file} -> ${name}`));

		expect(ungated).toEqual([]);
	});

	it("makes every canGoBack possibility actually send the player back", () => {
		const broken = events.flatMap(([file, event]) => Object.entries(event.possibilities ?? {})
			.filter(([, possibility]) => possibility.condition?.canGoBack
				&& !Object.values(possibility.outcomes)
					.every(outcome => outcome.goBackToPreviousMap))
			.map(([name]) => `${file} -> ${name}`));

		expect(broken).toEqual([]);
	});

	it("sends the player back the way they came in the hermit event", () => {
		expect(hermitEvent.possibilities.goBack.condition.canGoBack).toBe(true);
		expect(Object.values(hermitEvent.possibilities.goBack.outcomes)
			.every(outcome => outcome.goBackToPreviousMap)).toBe(true);
	});
});
