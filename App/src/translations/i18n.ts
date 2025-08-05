// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import {Language, LANGUAGE} from "../../../Lib/src/Language";
import {readdirSync} from "fs";
import {resolve} from "path";

function getI18nOptions(): i18next.InitOptions<unknown> {
	const resources: i18next.Resource = {};
	for (const language of LANGUAGE.LANGUAGES) {
		const resourceFiles: i18next.ResourceLanguage = {};
		const dirPath = `../../../Lang/${language}`;
		for (const file of readdirSync(resolve(__dirname, dirPath))) {
			if (file.endsWith(".json")) {
				console.log(`Loading i18next resource ${dirPath}/${file}`);
				resourceFiles[file.substring(0, file.length - 5)] = require(`${dirPath}/${file}`);
			}
		}
		resources[language] = resourceFiles;
	}

	return {
		fallbackLng: LANGUAGE.DEFAULT_LANGUAGE,
		interpolation: { escapeValue: false },
		resources
	};
}

/**
 * Replace in the given string all occurences of "{emote:...}" by the corresponding discord emote
 * @param str
 */
function convertEmoteFormat(str: string): string {
	return str.replace(/{emote:(.*?)}/g, (_match, emote) => getEmote(emote) ?? `EMOTE NOT FOUND : ${emote}`);
}

type EmotePathFolder = Record<string, unknown> | string[];
type EmotePath = EmotePathFolder | string;

export type TranslationOption = {
	lng: Language;
} & i18next.TOptions;

/**
 * Get the corresponding to emote for the given emote name
 * @param emote
 */
function getEmote(emote: string): string | null {
	try {
		let basePath: EmotePath = CrowniclesIcons as EmotePathFolder;
		const emotePath = emote.split(".");
		for (const path of emotePath) {
			if (typeof basePath === "string") {
				return null;
			}
			basePath = Array.isArray(basePath) ? basePath[parseInt(path, 10)] : basePath[path] as EmotePath;
		}
		return typeof basePath === "string" ? basePath : null;
	}
	catch (e) {
		console.error(`Error while getting emote ${emote}:`, e);
		return null;
	}
}

/**
 * Apply all the crownicles formatting to the given string
 * @param str
 */
function crowniclesFormat(str: string): string {
	return convertEmoteFormat(str);
}

i18next.init(getI18nOptions())
	.then();

export class I18nCrownicles {
	/**
	 * Translate the given key with the given options and returns all the objects found
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		lng: Language;
		returnObjects: true;
	} & i18next.TOptions): string[];

	/**
	 * Translate the given key with the given options
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		lng: Language;
		returnObjects?: false;
	} & i18next.TOptions): string;

	/**
	 * Translate the given key with the given options
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: {
		lng: Language;
		returnObjects: true;
	} & i18next.TOptions): Record<string, string>;

	/**
	 * Translate the given key with the given options
	 * Override of the i18next.t function to allow the following :
	 * - replace the "{command:...}" format by the corresponding discord command
	 * - force lng to be a Language value and being required
	 * - force the return type to be a string (and not a never)
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: TranslationOption): string | string[] | Record<string, string> {
		const value: string | string[] | object = i18next.t(key, options);
		if (options.returnObjects && !Array.isArray(value)) {
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
}

const i18n = I18nCrownicles;

export default i18n;
