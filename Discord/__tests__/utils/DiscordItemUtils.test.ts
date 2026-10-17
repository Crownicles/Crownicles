import {
	describe, expect, it
} from "vitest";
import { DiscordItemUtils } from "../../src/utils/DiscordItemUtils";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";
import { LANGUAGE } from "../../../Lib/src/Language";

describe("DiscordItemUtils.getObjectNatureDisplay", () => {
	it("shows a fight object power capped by the player stats instead of NaN (#4843)", () => {
		const display = DiscordItemUtils.getObjectNatureDisplay(ItemNature.SPEED, 87, 80, LANGUAGE.FRENCH);

		expect(display).not.toContain("NaN");
		expect(display).toContain("~~87~~ 80");
	});

	it("groups the digits of an uncapped fight object power", () => {
		const display = DiscordItemUtils.getObjectNatureDisplay(ItemNature.ATTACK, 1234, 5000, LANGUAGE.FRENCH);

		expect(display).toMatch(/Attaque \+ 1\s234 /u);
	});

	it.each([LANGUAGE.ENGLISH, LANGUAGE.SPANISH])("keeps a capped fight object power readable in %s", lng => {
		expect(DiscordItemUtils.getObjectNatureDisplay(ItemNature.SPEED, 87, 80, lng)).toContain("~~87~~ 80");
	});

	it.each([
		[LANGUAGE.ENGLISH, "1,234"],
		[LANGUAGE.GERMAN, "1.234"]
	])("groups the digits of an uncapped fight object power in %s", (lng, expected) => {
		const display = DiscordItemUtils.getObjectNatureDisplay(ItemNature.ATTACK, 1234, 5000, lng);

		expect(display).not.toContain("NaN");
		expect(display).toContain(`+ ${expected} `);
	});
});
