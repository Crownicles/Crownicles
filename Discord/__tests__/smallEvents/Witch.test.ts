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
			if (key === "smallEvents:witch.witchEventResults.outcomes.2.time") {
				return "Temps perdu";
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

describe("buildTimeOutro (via buildWitchResultDescription)", () => {
	it("ajoute le texte de temps perdu quand outcome est EFFECT avec OCCUPIED et timeLost > 0", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: false,
			effectId: Effect.OCCUPIED.id,
			timeLost: 600,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.EFFECT
		} as never, "fr");

		expect(description).toContain("Temps perdu");
	});

	it("ajoute le texte de temps perdu quand forceEffect est vrai avec OCCUPIED et timeLost > 0", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: true,
			effectId: Effect.OCCUPIED.id,
			timeLost: 600,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.POTION
		} as never, "fr");

		expect(description).toContain("Temps perdu");
	});

	it("n'ajoute pas le texte de temps perdu quand timeLost est 0", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: false,
			effectId: Effect.OCCUPIED.id,
			timeLost: 0,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.EFFECT
		} as never, "fr");

		expect(description).not.toContain("Temps perdu");
	});

	it("n'ajoute pas le texte de temps perdu quand l'effet n'est pas OCCUPIED", () => {
		const description = buildWitchResultDescription({
			ingredientId: "sing",
			isIngredient: false,
			forceEffect: false,
			effectId: Effect.DRUNK.id,
			timeLost: 600,
			lifeLoss: 0,
			outcome: WitchActionOutcomeType.EFFECT
		} as never, "fr");

		expect(description).not.toContain("Temps perdu");
	});
});