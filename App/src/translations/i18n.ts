// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import {Language} from "@/src/translations/Language";
import {AppIcons} from "@/src/AppIcons";
import {reloadI18n} from "@/src/translations/i18nLoader";

/**
 * Get the corresponding to emote for the given emote name
 * @param path
 */
function getEmote(path: string): string | null {
	const emote = AppIcons.getIconOrNull(path);

	if (emote === null) {
		console.error(`Missing emote: ${emote}:`);
		return null;
	}

	return emote;
}

/**
 * Replace in the given string all occurences of "{emote:...}" by the corresponding discord emote
 * @param str
 */
function convertEmoteFormat(str: string): string {
	return str.replace(/{emote:(.*?)}/g, (_match, emote) => getEmote(emote) ?? `EMOTE NOT FOUND : ${emote}`);
}

/**
 * Apply all the crownicles formatting to the given string
 * @param str
 */
function crowniclesFormat(value: unknown): string {
	if (typeof value !== "string") {
		return value == null ? "" : String(value);
	}
	return convertEmoteFormat(value);
}

export class I18nCrownicles {
	/**
	 * Translate the given key with the given options and returns all the objects found
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		returnObjects: true;
	} & i18next.TOptions): string[];

	/**
	 * Translate the given key with the given options
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		returnObjects?: false;
	} & i18next.TOptions): string;

	/**
	 * Translate the given key with the given options
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		returnObjects: true;
	} & i18next.TOptions): Record<string, string>;

	/**
	 * Translate the given key with the given options
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options?: i18next.TOptions): string;

	/**
	 * Translate the given key with the given options
	 * Override of the i18next.t function to allow the following :
	 * - replace the "{command:...}" format by the corresponding discord command
	 * - force lng to be a Language value and being required
	 * - force the return type to be a string (and not a never)
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options?: i18next.TOptions): string | string[] | Record<string, string> {
		const value: string | string[] | object | undefined = i18next.t(key, options);
		if (value === undefined || value === null) {
			if (options?.returnObjects) {
				return Array.isArray(key) ? [] : {};
			}
			return Array.isArray(key) ? key[0] : key;
		}
		if (options?.returnObjects && !Array.isArray(value)) {
			return Object.entries(value)
				.reduce((acc, [k, v]) => {
					acc[k] = crowniclesFormat(v as string);
					return acc;
				}, {} as Record<string, string>);
		}
		if (Array.isArray(value)) {
			return (value as string[]).map(crowniclesFormat);
		}
		return crowniclesFormat(value);
	}

	/**
	 * Return all variants of an array translation. Discord uses the same helper
	 * for small-event stories, so the app can reuse those resources safely.
	 */
	static tArray(key: string, options?: i18next.TOptions): string[] {
		const value = i18next.t(key, {...options, returnObjects: true});
		if (Array.isArray(value)) {
			return value.map(crowniclesFormat);
		}
		if (typeof value === "string") {
			return [crowniclesFormat(value)];
		}
		return [];
	}

	static async changeLanguage(language: Language): Promise<void> {
		await i18next.changeLanguage(language);
	}
}

// Initialise the native bundle immediately so loading and authentication screens
// can safely call i18n before the downloaded language assets are ready. Asset
// reloads are queued by the loader and replace this bootstrap resource set.
reloadI18n().catch(error => {
	console.error("Failed to initialize translations:", error);
});

export const i18n = I18nCrownicles;
