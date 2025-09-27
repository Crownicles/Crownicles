import { describe, it, expect } from 'vitest';
import emojiRegex from 'emoji-regex';
import {CrowniclesIcons} from "../src/CrowniclesIcons";

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
	it('should contains only fully qualified emotes', () => {
		const allStrings = collectAllStrings(CrowniclesIcons);

		const failed: { value: string; path: string }[] = [];

		for (const entry of allStrings) {
			if (!isFullyQualifiedEmoji(entry.value)) {
				failed.push(entry);
			}
		}

		if (failed.length > 0) {
			console.error('\n❌ Not fully qualified icons :');
			for (const f of failed) {
				console.error(` - ${f.path} → "${f.value}"`);
			}
		}

		expect(failed.length).toBe(0);
	});
});
