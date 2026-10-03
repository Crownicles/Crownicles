import i18next from "i18next";
import {AppIcons} from "@/src/AppIcons";
import {loadGameRules} from "@/src/rules/GameRules";
import type {AssetsBundle} from "../../../WsPackets/src/objects/AssetsBundle";
import {embeddedTranslations} from "@/src/translations/embeddedTranslations";

const warnedMissingKeys = new Set<string>();

i18next.init({
	lng: "fr",
	fallbackLng: "fr",
	resources: {fr: embeddedTranslations},
	interpolation: {escapeValue: false},
	initAsync: false,
	saveMissing: true,
	missingKeyHandler: (languages, namespace, key): void => {
		const language = languages[0] ?? "fr";
		if (__DEV__) {
			console.warn("Missing translation", language, namespace, key);
			return;
		}

		const identifier = `${namespace}:${key}`;
		if (!warnedMissingKeys.has(identifier)) {
			warnedMissingKeys.add(identifier);
			console.warn("Missing translation", language, namespace, key);
		}
	}
});

export function applyServerBundle(bundle: AssetsBundle): void {
	for (const [namespace, translations] of Object.entries(bundle.namespaces)) {
		i18next.addResourceBundle(bundle.language, namespace, translations, true, true);
	}
	AppIcons.reloadAppIcons(bundle.icons);
	loadGameRules(bundle.rules);
}

/**
 * Language i18next currently resolves keys in. Read through the module that owns the instance so
 * callers do not have to know how i18next is imported.
 */
export function currentLanguage(): string {
	return i18next.language;
}
