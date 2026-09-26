import {amountEffect, lostAmountEffect, presentEffects} from "@/src/display/OutcomeEffects";
import {EFFECT_TONES} from "@/src/design/Sections";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key, language: "en"}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));

describe("event outcome effects", () => {
	it("tells a gain from a loss and wears the emoji of the loss when the game has one", () => {
		expect(amountEffect("money", 20, {gain: "money", loss: "lostMoney"})).toEqual({label: "money", value: "+20", tone: EFFECT_TONES.GAIN, unit: "money"});
		expect(amountEffect("money", -20, {gain: "money", loss: "lostMoney"})).toEqual({label: "money", value: "-20", tone: EFFECT_TONES.LOSS, unit: "lostMoney"});
	});

	it("says nothing about a counter that did not move", () => {
		expect(presentEffects([amountEffect("points", 0, {gain: "score"}), lostAmountEffect("health", 0, "lostHealth")])).toEqual([]);
	});

	it("turns a quantity taken away into a loss", () => {
		expect(lostAmountEffect("health", 7, "lostHealth")).toEqual({label: "health", value: "-7", tone: EFFECT_TONES.LOSS, unit: "lostHealth"});
	});
});
