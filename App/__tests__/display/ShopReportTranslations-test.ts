import { changeLanguage } from "i18next";
import { shopOutcomeReport } from "@/src/display/ShopReport";
import { applyServerBundle } from "@/src/translations/i18nLoader";
import { fakeGameRules } from "@/src/testing/fakeGameRules";
import frenchCommands from "../../../Lang/fr/commands.json";

const NOW = 1_700_000_000_000;

describe("shop answers written with the French translations", () => {
	beforeAll(async () => {
		await changeLanguage("fr");
		applyServerBundle({
			language: "fr", namespaces: { commands: frenchCommands }, icons: {}, rules: fakeGameRules
		});
	});

	it.each([
		["alreadyBoughtPointsThisWeek", frenchCommands.missionsshop.error.alreadyBoughtPointsThisWeek],
		["noMissionToSkip", frenchCommands.missionsshop.error.noMissionToSkip]
	] as const)("tells the mission shop refusal %s in words, not as a translation key", (kind, sentence) => {
		expect(shopOutcomeReport({ kind }, NOW)).toBe(sentence);
	});
});
