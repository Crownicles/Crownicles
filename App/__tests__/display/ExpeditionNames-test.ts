import { changeLanguage } from "i18next";
import { expeditionLocationTitle } from "@/src/display/PetExpedition";
import { applyServerBundle } from "@/src/translations/i18nLoader";
import { fakeGameRules } from "@/src/testing/fakeGameRules";

describe("expedition names", () => {
	beforeAll(async () => {
		await changeLanguage("fr");
		applyServerBundle({
			language: "fr",
			namespaces: { commands: { petExpedition: { mapLocationExpeditions: {
				"5": "le Chemin du Dédale",
				"5_forest": "les Sous-bois Sinueux du Chemin du Dédale",
				"5_ruins": "les Labyrinthes Oubliés du Chemin du Dédale",
				"12": "la Forêt Célestrum"
			} } } },
			icons: {},
			rules: fakeGameRules
		});
	});

	it("names each expedition of a location mixing two biomes after the biome it explores", () => {
		expect(expeditionLocationTitle({
			mapLocationId: 5, locationType: "forest"
		})).toBe("les Sous-bois Sinueux du Chemin du Dédale");
		expect(expeditionLocationTitle({
			mapLocationId: 5, locationType: "ruins"
		})).toBe("les Labyrinthes Oubliés du Chemin du Dédale");
	});

	it("keeps the location name when it has no name of its own for the explored biome", () => {
		expect(expeditionLocationTitle({
			mapLocationId: 12, locationType: "forest"
		})).toBe("la Forêt Célestrum");
	});
});
