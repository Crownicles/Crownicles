import {CrowniclesIcons} from "../../../Lib/src/CrowniclesIcons";
import {describe, expect, it} from 'vitest';
import {StringSelectMenuOptionBuilder} from "discord.js";
import emojiRegex from 'emoji-regex';


const regex = emojiRegex();

function isFullyQualifiedEmoji(str: string): boolean {
	const match = str.match(regex);
	return match !== null && match[0] === str;
}

function collectAllStrings(
	obj: unknown,
	path: string[] = []
): { value: string; path: string }[] {
	const result: { value: string; path: string }[] = [];

	if (typeof obj === 'string') {
		result.push({ value: obj, path: path.join('.') });
	} else if (Array.isArray(obj)) {
		obj.forEach((item, index) => {
			result.push(...collectAllStrings(item, [...path, `[${index}]`]));
		});
	} else if (typeof obj === 'object' && obj !== null) {
		for (const key in obj) {
			result.push(...collectAllStrings((obj as any)[key], [...path, key]));
		}
	}

	return result;
}

describe('CrowniclesIcons Unicode validation', () => {
	it('should build select menu options with all emojis', () => {
		const allStrings = collectAllStrings(CrowniclesIcons);

		for (let index = 0; index < allStrings.length; index++) {
			const entry = allStrings[index];
			if (isFullyQualifiedEmoji(entry.value)) {
				expect(() => {
					new StringSelectMenuOptionBuilder()
						.setLabel('Test')
						.setDescription('Test')
						.setValue(index.toString())
						.setEmoji(entry.value);
				}).not.toThrow();
			}
		}
	});
});