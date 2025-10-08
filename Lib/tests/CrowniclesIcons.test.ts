import { describe, it, expect, beforeAll } from 'vitest';
import {CrowniclesIcons} from "../src/CrowniclesIcons";

let fullyQualifiedEmojis: Set<string>;

beforeAll(async () => {
	const response = await fetch('https://unicode.org/Public/emoji/15.1/emoji-test.txt');
	const text = await response.text();

	fullyQualifiedEmojis = new Set<string>();

	const lines = text.split('\n');
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
	it('should contain only fully qualified emojis', () => {
		const allStrings = collectAllStrings(CrowniclesIcons);
		const failed: { value: string; path: string; codePoints: string }[] = [];

		for (const entry of allStrings) {
			if (!fullyQualifiedEmojis.has(entry.value)) {
				const codePoints = Array.from(entry.value)
					.map(char => `U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`)
					.join(' ');
				failed.push({ ...entry, codePoints });
			}
		}

		if (failed.length > 0) {
			console.error('\n❌ Not fully qualified icons:');
			for (const f of failed) {
				console.error(` - ${f.path} → "${f.value}" (${f.codePoints})`);
			}
		}

		expect(failed.length, `Found ${failed.length} invalid emoji(s)`).toBe(0);
	});
});