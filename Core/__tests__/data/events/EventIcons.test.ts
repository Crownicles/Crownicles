import {
	describe, expect, it
} from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";

const EVENTS_DIRECTORY = resolve(__dirname, "../../../resources/events");
const END_POSSIBILITY = "end";

type EventIcons = Record<string, string | Record<string, string>>;

/**
 * List the icons a big event needs in Discord: one per choice button, and one per outcome of the "end" possibility,
 * shown when the player does not answer
 */
function getMissingIcons(eventId: string, possibilities: Record<string, { outcomes: Record<string, unknown> }>): string[] {
	const icons = (CrowniclesIcons.events as Record<string, EventIcons | undefined>)[eventId];
	const missing: string[] = [];
	for (const [possibilityName, possibility] of Object.entries(possibilities)) {
		if (possibilityName !== END_POSSIBILITY) {
			if (typeof icons?.[possibilityName] !== "string") {
				missing.push(`${eventId}.${possibilityName}`);
			}
			continue;
		}
		const endIcons = icons?.[END_POSSIBILITY];
		for (const outcomeId of Object.keys(possibility.outcomes)) {
			if (typeof endIcons !== "object" || typeof endIcons[outcomeId] !== "string") {
				missing.push(`${eventId}.${END_POSSIBILITY}.${outcomeId}`);
			}
		}
	}
	return missing;
}

describe("Big event icons", () => {
	it("should have an icon for every possibility and every outcome of the end possibility", () => {
		const missing = readdirSync(EVENTS_DIRECTORY)
			.filter(file => file.endsWith(".json"))
			.flatMap(file => {
				const event = JSON.parse(readFileSync(resolve(EVENTS_DIRECTORY, file), "utf-8"));
				return getMissingIcons(file.replace(".json", ""), event.possibilities);
			});

		expect(missing).toEqual([]);
	});
});
