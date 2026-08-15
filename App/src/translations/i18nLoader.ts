import i18next from "i18next";
import {LANGUAGE} from "@/src/translations/Language";
import englishNative from "./lang/en/native.json";
import frenchNative from "./lang/fr/native.json";
import italianNative from "./lang/it/native.json";
import spanishNative from "./lang/es/native.json";
import portugueseNative from "./lang/pt/native.json";
import germanNative from "./lang/de/native.json";

interface LanguageAssetLocation {
	language: string;
	namespace: string;
}

type LanguageAssetPath = [string, string, string, ...string[]];

function isLanguageAssetPath(parts: string[]): parts is LanguageAssetPath {
	const hasExpectedSegmentCount = parts.length >= 3;
	const isLanguageDirectory = parts[0]?.startsWith("Lang") ?? false;
	const hasLanguage = Boolean(parts[1]);
	const hasJsonNamespace = parts[2]?.endsWith(".json") ?? false;

	return hasExpectedSegmentCount && isLanguageDirectory && hasLanguage && hasJsonNamespace;
}

function getLanguageAssetLocation(path: string): LanguageAssetLocation | null {
	const split = path.split("/");
	if (!isLanguageAssetPath(split)) {
		return null;
	}
	return {
		language: split[1],
		namespace: split[2].replace(".json", "")
	};
}

function loadLanguageAssets(languagesAssets: Map<string, string>): void {
	for (const languageAsset of languagesAssets.entries()) {
		console.log(`Loading i18next resource ${languageAsset[0]}`);
		const location = getLanguageAssetLocation(languageAsset[0]);
		if (!location) {
			console.warn(`Invalid language asset path: ${languageAsset[0]}`);
			continue;
		}

		i18next.addResourceBundle(location.language, location.namespace, JSON.parse(languageAsset[1]));
	}
}

function loadNativeLanguageAssets(): void {
	i18next.addResourceBundle(LANGUAGE.ENGLISH, "native", englishNative);
	i18next.addResourceBundle(LANGUAGE.FRENCH, "native", frenchNative);
	i18next.addResourceBundle(LANGUAGE.ITALIAN, "native", italianNative);
	i18next.addResourceBundle(LANGUAGE.SPANISH, "native", spanishNative);
	i18next.addResourceBundle(LANGUAGE.PORTUGUESE, "native", portugueseNative);
	i18next.addResourceBundle(LANGUAGE.GERMAN, "native", germanNative);
}

export async function reloadI18n(languagesAssets = new Map<string, string>()): Promise<void> {
	await i18next.init({
		fallbackLng: LANGUAGE.DEFAULT_LANGUAGE,
		interpolation: { escapeValue: false },
		resources: {},
	});

	// todo for testing, remove later
	await i18next.changeLanguage(LANGUAGE.FRENCH);

	loadLanguageAssets(languagesAssets);
	loadNativeLanguageAssets();
}