import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";

/**
 * Remove discord formatting scrap from usernames
 * @param username
 */
export function escapeUsername(username: string): string {
	let fixedName = username.replace(/[*`_|]/gu, "");
	if (fixedName === "") {
		fixedName = ".";
	}
	return fixedName;
}

export abstract class StringUtils {
	static getRandomTranslation(tr: string, lng: Language, replacements: { [key: string]: unknown } = {}): string {
		// If context is provided, append it to the translation key for array translations
		const translationKey = replacements.context ? `${tr}_${replacements.context}` : tr;

		// Remove context from replacements since it was already used to build the translation key
		const {
			context: _, ...remainingReplacements
		} = replacements;
		const intros = i18n.tArray(translationKey, {
			lng,
			...remainingReplacements
		});
		return intros[Math.floor(Math.random() * intros.length)];
	}

	static capitalizeFirstLetter(str: string): string {
		if (str.length === 0) {
			return "";
		}

		if (str.length === 1) {
			return str.toUpperCase();
		}

		return str.charAt(0)
			.toUpperCase() + str.slice(1);
	}

	/**
	 * Format a string as a Discord level-3 markdown header (`### `).
	 * Centralises the `###` token so it lives in one place rather than being
	 * hardcoded next to every `i18n.t()` call that needs a header.
	 */
	static formatHeader(title: string): string {
		return `### ${title}`;
	}

	/**
	 * Join several text blocks with a blank line between each (Discord paragraph break).
	 * Falsy/empty entries are skipped so callers can pass conditional blocks directly.
	 */
	static joinParagraphs(parts: ReadonlyArray<string | false | null | undefined>): string {
		return parts.filter((p): p is string => Boolean(p)).join("\n\n");
	}
}
