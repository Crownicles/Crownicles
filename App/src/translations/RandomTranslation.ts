import {TOptions} from "i18next";
import {i18n} from "@/src/translations/i18n";

function stableStringHash(value: string): number {
	let hash = 0;
	for (const character of value) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}
	return hash;
}

/** Picks one of the written variants, always the same one for the same subject, so a screen never flickers between wordings. */
export function randomTranslation(key: string, options: TOptions = {}): string {
	const translations = i18n.tArray(key, options);
	if (translations.length === 0) {
		return i18n.t(key, options);
	}
	const variant = stableStringHash(`${key}:${JSON.stringify(options)}`) % translations.length;
	return translations[variant];
}
