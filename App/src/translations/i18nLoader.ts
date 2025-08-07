import i18next from "i18next";
import {LANGUAGE} from "@/src/translations/Language";

export async function reloadI18n(languagesAssets = new Map<string, string>()): Promise<void> {
	await i18next.init({
		fallbackLng: LANGUAGE.DEFAULT_LANGUAGE,
		interpolation: { escapeValue: false },
		resources: {},
	});

	// todo for testing, remove later
	await i18next.changeLanguage(LANGUAGE.FRENCH);

	for (const languageAsset of languagesAssets.entries()) {
		console.log(`Loading i18next resource ${languageAsset[0]}`);
		const split = languageAsset[0].split("/");
		if (split.length < 3 || !split[0].startsWith("Lang") || !split[1] || !split[2].endsWith(".json")) {
			console.warn(`Invalid language asset path: ${languageAsset[0]}`);
			continue;
		}
		const language = split[1];
		const namespace = split[2].replace(".json", "");
		const translations = JSON.parse(languageAsset[1]);

		i18next.addResourceBundle(language, namespace, translations);
	}

	i18next.addResourceBundle(LANGUAGE.ENGLISH, "native", require("./lang/en/native.json"));
	i18next.addResourceBundle(LANGUAGE.FRENCH, "native", require("./lang/fr/native.json"));
	i18next.addResourceBundle(LANGUAGE.ITALIAN, "native", require("./lang/it/native.json"));
	i18next.addResourceBundle(LANGUAGE.SPANISH, "native", require("./lang/es/native.json"));
	i18next.addResourceBundle(LANGUAGE.PORTUGUESE, "native", require("./lang/pt/native.json"));
	i18next.addResourceBundle(LANGUAGE.GERMAN, "native", require("./lang/de/native.json"));
}