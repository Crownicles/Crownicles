import { describe, expect, it, vi } from "vitest";
import { Effect } from "../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../Lib/src/types/WitchActionOutcomeType";
import { buildWitchResultDescription } from "../../src/smallEvents/WitchResultDescription";

vi.mock("../../src/translations/i18n", () => ({
	default: {
		t: vi.fn((key: string) => {
			if (key === "smallEvents:witch.witchEventNames.sing") {
				return "Chanter une mélodie";
			}
			return key;
		}),
		formatDuration: vi.fn(() => "10 minutes")
	}
}));

vi.mock("../../src/utils/StringUtils", () => ({
	StringUtils: {
		getRandomTranslation: vi.fn((key: string, _lng: string, replacements?: Record<string, string>) => {
			if (key.includes("Intros")) {
				return `Intro ${replacements?.witchEvent}`;
			}
			if (key === "smallEvents:witch.witchEventResults.outcomes.1") {
				return "Résultat potion";
			}
			if (key.startsWith("smallEvents:witch.witchEventResults.outcomes.2.")) {
				return "Résultat altération";
			}
			return key;
		})
	}
}));

describe("buildWitchResultDescription", () => {
	it("ajoute l'emoji d'altération pour une action forceEffect sans outcome effect", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: true,
			effectId: Effect.DRUNK.id,
			timeLost: 0,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.POTION
		} as never, "fr");

		expect(description).toContain("Résultat potion 🤪");
	});

	it("n'ajoute pas d'emoji supplémentaire quand l'outcome est déjà EFFECT", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: true,
			effectId: Effect.DRUNK.id,
			timeLost: 0,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.EFFECT
		} as never, "fr");

		expect(description).toContain("Résultat altération");
		expect(description).not.toContain("Résultat altération 🤪");
	});
});