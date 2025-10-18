import {CrowniclesIcons} from "../../../Lib/src/CrowniclesIcons";
import {describe, expect, it, beforeAll} from 'vitest';
import {StringSelectMenuOptionBuilder} from "discord.js";
import { readFile } from 'fs/promises';
import { join } from 'path';

let fullyQualifiedEmojis: Set<string>;

beforeAll(async () => {
	const emojiTestData = await readFile(join(__dirname, '..', '..', '..', 'Lib', 'tests', 'fixtures', 'emoji-test.txt'), 'utf-8');
	fullyQualifiedEmojis = new Set<string>();

	const lines = emojiTestData.split('\n');
	for (const line of lines) {
		if (line.startsWith('#') || line.trim() === '') {
			continue;
		}

		const match = line.match(/^([0-9A-F\s]+)\s*;\s*fully-qualified\s*#\s*(.+)$/);
		if (match) {
			const emojiMatch = match[2].match(/^\s*(\S+)/);
			if (emojiMatch) {
				fullyQualifiedEmojis.add(emojiMatch[1]);
			}
		}
	}
});

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
			if (fullyQualifiedEmojis.has(entry.value)) {
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