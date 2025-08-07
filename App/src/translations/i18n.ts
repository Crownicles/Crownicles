// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import {Language} from "@/src/translations/Language";
import {AppIcons} from "@/src/AppIcons";
import {reloadI18n} from "@/src/translations/i18nLoader";

/**
 * Replace in the given string all occurences of "{emote:...}" by the corresponding discord emote
 * @param str
 */
function convertEmoteFormat(str: string): string {
	return str.replace(/{emote:(.*?)}/g, (_match, emote) => getEmote(emote) ?? `EMOTE NOT FOUND : ${emote}`);
}

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
 * Apply all the crownicles formatting to the given string
 * @param str
 */
function crowniclesFormat(str: string): string {
	return convertEmoteFormat(str);
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
		const value: string | string[] | object = i18next.t(key, options);
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

	static async changeLanguage(language: Language): Promise<void> {
		await i18next.changeLanguage(language);
	}
}

reloadI18n().then();

export const i18n = I18nCrownicles;
