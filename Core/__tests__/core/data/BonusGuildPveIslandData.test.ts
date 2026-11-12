import {
	describe, expect, it
} from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import bonusGuildPveIsland from "../../../resources/smallEvents/bonusGuildPVEIsland.json";
import { SmallEventBonusGuildPVEIslandEmote } from "../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";

type Outcome = keyof typeof bonusGuildPveIsland.properties.ranges;

type OutcomeTexts = Record<string, string>;

type EventTexts = {
	intro: string;
	success: OutcomeTexts;
	lose: OutcomeTexts;
};

const DYNAMIC_EMOTE = "{{emoteKey}}";

// Emote a text may hardcode for each outcome: a text announcing a money loss must not take health, and conversely
const HARDCODED_EMOTE_BY_OUTCOME: Record<Outcome, string | null> = {
	money: SmallEventBonusGuildPVEIslandEmote.LOST_MONEY,
	life: SmallEventBonusGuildPVEIslandEmote.LOST_HEALTH,
	experience: SmallEventBonusGuildPVEIslandEmote.EXPERIENCE,
	expOrPointsGuild: null
};

function getFrenchEventTexts(): EventTexts[] {
	const frSmallEvents = JSON.parse(readFileSync(resolve(__dirname, "../../../../Lang/fr/smallEvents.json"), "utf8"));
	return frSmallEvents.bonusGuildPVEIsland.events;
}

describe("bonus guild PvE island event data", () => {
	it("uses the life malus for the pebble injury", () => {
		const pebbleEvent = bonusGuildPveIsland.properties.events[3];

		expect(pebbleEvent.lose.withGuild).toBe("life");
		expect(pebbleEvent.lose.solo).toBe("life");
		expect(bonusGuildPveIsland.properties.ranges.life).toEqual({
			min: 3,
			max: 10
		});
	});

	it("applies the outcome each French text announces", () => {
		const eventTexts = getFrenchEventTexts();
		expect(eventTexts).toHaveLength(bonusGuildPveIsland.properties.events.length);

		const mismatches: string[] = [];
		bonusGuildPveIsland.properties.events.forEach((event, eventIndex) => {
			for (const result of ["success", "lose"] as const) {
				for (const [textSurrounding, text] of Object.entries(eventTexts[eventIndex][result])) {
					// The "soloWithGuild" text is shown to a player with a guild, so it applies the "withGuild" outcome
					const outcome = event[result][textSurrounding === "solo" ? "solo" : "withGuild"] as Outcome;
					const emote = /unitValues\.(\{\{emoteKey\}\}|\w+)/.exec(text)?.[1];
					if (emote !== DYNAMIC_EMOTE && emote !== HARDCODED_EMOTE_BY_OUTCOME[outcome]) {
						mismatches.push(`event ${eventIndex} ${result}.${textSurrounding}: the text shows ${emote} but the data applies ${outcome}`);
					}
				}
			}
		});

		expect(mismatches).toEqual([]);
	});
});
