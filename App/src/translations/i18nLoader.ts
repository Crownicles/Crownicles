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
type I18nResources = Record<string, Record<string, object>>;

/**
 * Assets are downloaded asynchronously while the app is starting. Keeping the
 * reloads in a single chain prevents a second i18next.init() from racing with
 * the first one and resetting resources that have just been loaded.
 */
let reloadChain: Promise<void> | null = null;

function isLanguageAssetPath(parts: string[]): parts is LanguageAssetPath {
	const hasExpectedSegmentCount = parts.length >= 3;
	const isLanguageDirectory = parts[0] === "Lang";
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

function loadLanguageAssets(languagesAssets: Map<string, string>): I18nResources {
	const resources: I18nResources = {};
	for (const languageAsset of languagesAssets.entries()) {
		const location = getLanguageAssetLocation(languageAsset[0]);
		if (!location || !LANGUAGE.LANGUAGES.includes(location.language as typeof LANGUAGE.LANGUAGES[number])) {
			console.warn(`Invalid language asset path: ${languageAsset[0]}`);
			continue;
		}

		try {
			resources[location.language] ??= {};
			resources[location.language][location.namespace] = JSON.parse(languageAsset[1]) as object;
		}
		catch (error) {
			console.error(`Failed to parse language asset ${languageAsset[0]}`, error);
		}
	}
	return resources;
}

function loadNativeLanguageAssets(resources: I18nResources): void {
	resources[LANGUAGE.ENGLISH] ??= {};
	resources[LANGUAGE.ENGLISH].native = englishNative;
	resources[LANGUAGE.FRENCH] ??= {};
	resources[LANGUAGE.FRENCH].native = frenchNative;
	resources[LANGUAGE.ITALIAN] ??= {};
	resources[LANGUAGE.ITALIAN].native = italianNative;
	resources[LANGUAGE.SPANISH] ??= {};
	resources[LANGUAGE.SPANISH].native = spanishNative;
	resources[LANGUAGE.PORTUGUESE] ??= {};
	resources[LANGUAGE.PORTUGUESE].native = portugueseNative;
	resources[LANGUAGE.GERMAN] ??= {};
	resources[LANGUAGE.GERMAN].native = germanNative;
}

export async function reloadI18n(languagesAssets = new Map<string, string>()): Promise<void> {
	const reload = async (): Promise<void> => {
		const resources = loadLanguageAssets(languagesAssets);
		loadNativeLanguageAssets(resources);
		const currentLanguage = LANGUAGE.LANGUAGES.includes(i18next.language?.split("-")[0] as typeof LANGUAGE.LANGUAGES[number])
			? i18next.language.split("-")[0]
			: LANGUAGE.FRENCH;

		// eslint-disable-next-line import/no-named-as-default-member
		await i18next.init({
			lng: currentLanguage,
			fallbackLng: [LANGUAGE.DEFAULT_LANGUAGE, LANGUAGE.FRENCH],
			interpolation: { escapeValue: false },
			resources,
		});
	};

	// Start the first bootstrap immediately. This makes i18next initialise before
	// React renders the asset-loading overlay; later reloads stay serialised.
	reloadChain = reloadChain === null ? reload() : reloadChain.then(reload, reload);
	return reloadChain;
}
