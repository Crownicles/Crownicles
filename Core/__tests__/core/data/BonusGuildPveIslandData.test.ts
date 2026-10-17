import {
	describe, expect, it
} from "vitest";
import bonusGuildPveIsland = require("../../../resources/smallEvents/bonusGuildPVEIsland.json");

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
});