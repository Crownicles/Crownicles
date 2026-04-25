// skipcq: JS-C1003 - i18next does not expose itself as an ES Module.
import * as i18next from "i18next";
import {
	Language, LANGUAGE
} from "../../../Lib/src/Language";
import { readdirSync } from "fs";
import { resolve } from "path";
import { BotUtils } from "../utils/BotUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { minutesDisplayIntl } from "../../../Lib/src/utils/TimeUtils";

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
		interpolation: {
			escapeValue: false,
			format: (value, format, lng): string => {
				if (format === "number" && Number.isFinite(value)) {
					return new Intl.NumberFormat(lng, { useGrouping: true }).format(value);
				}
				return String(value);
			}
		},
		resources
	};
}


/**
 * Replace in the given string all occurences of "{command:...}" by the corresponding discord command name
 * @param str
 */
function convertCommandFormat(str: string): string {
	return str.replace(/{command:(.*?)}/g, (_match, command) => BotUtils.commandsMentions.get(command) ?? `\`COMMAND NOT FOUND : ${command}\``);
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

export type I18nCrowniclesOptions = Omit<i18next.TOptions, "context" | "returnObjects"> & {
	lng: Language;
	context?: string;
};

export type I18nCrowniclesReturnObjectsOptions = I18nCrowniclesOptions & {
	returnObjects: true;
};

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
		CrowniclesLogger.errorWithObj(`Error while getting emote ${emote}`, e);
		return null;
	}
}

/**
 * Apply all the crownicles formatting to the given string
 * @param str
 */
function crowniclesFormat(str: string): string {
	return convertCommandFormat(convertEmoteFormat(str));
}

i18next.init(getI18nOptions())
	.then();

export class I18nCrownicles {
	/**
	 * Translate the given key with the given options.
	 * Use tArray or tRecord for returnObjects translations.
	 * Override of the i18next.t function to allow the following:
	 * - replace the "{command:...}" format by the corresponding discord command
	 * - force lng to be a Language value and being required
	 * - force the return type to be a string
	 * @param key
	 * @param options
	 */
	static t(key: string | string[], options: I18nCrowniclesOptions): string {
		return crowniclesFormat(i18next.t(key, options) as string);
	}

	/**
	 * Translate the given key with returnObjects=true and return a string array.
	 * @param key
	 * @param options
	 */
	static tArray(key: string | string[], options: I18nCrowniclesReturnObjectsOptions): string[] {
		return (i18next.t(key, options) as string[]).map(crowniclesFormat);
	}

	/**
	 * Translate the given key with returnObjects=true and return a string record.
	 * @param key
	 * @param options
	 */
	static tRecord(key: string | string[], options: I18nCrowniclesReturnObjectsOptions): Record<string, string> {
		return Object.entries(i18next.t(key, options) as Record<string, string>)
			.reduce((acc, [recordKey, value]) => {
				acc[recordKey] = crowniclesFormat(value);
				return acc;
			}, {} as Record<string, string>);
	}

	/**
	 * Display a time in a human-readable format using Intl.DurationFormat
	 * @param minutes - the time in minutes
	 * @param lng - language code
	 */
	static formatDuration(minutes: number, lng: Language): string {
		return minutesDisplayIntl(minutes, lng);
	}
}

const i18n = I18nCrownicles;

export default i18n;
