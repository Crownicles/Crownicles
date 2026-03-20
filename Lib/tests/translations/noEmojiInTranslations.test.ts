import { describe, it, expect, beforeAll } from "vitest";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const LANG_DIR = join(__dirname, "..", "..", "..", "Lang");

let allEmojis: Set<string>;

/**
 * Build a set of all known emojis from the Unicode emoji-test.txt reference file.
 * We include all statuses (fully-qualified, minimally-qualified, unqualified, component)
 * to catch any form of emoji that could appear in translation files.
 */
beforeAll(async () => {
	const emojiTestData = await readFile(join(__dirname, "..", "fixtures", "emoji-test.txt"), "utf-8");
	allEmojis = new Set<string>();

	for (const line of emojiTestData.split("\n")) {
		if (line.startsWith("#") || line.trim() === "") {
			continue;
		}

		// Format: "code points ; status # emoji name"
		const match = line.match(/^([0-9A-F\s]+)\s*;\s*\S+\s*#\s*(.+)$/);
		if (match) {
			const emojiMatch = match[2].match(/^\s*(\S+)/);
			if (emojiMatch) {
				allEmojis.add(emojiMatch[1]);
			}
		}
	}
});

/**
 * Recursively collect all string values from a JSON object/array,
 * tracking the JSON path for clear error reporting.
 */
function collectAllStrings(
	obj: unknown,
	path: string[] = []
): { value: string; path: string }[] {
	const result: { value: string; path: string }[] = [];

	if (typeof obj === "string") {
		result.push({ value: obj, path: path.join(".") });
	}
	else if (Array.isArray(obj)) {
		obj.forEach((item, index) => {
			result.push(...collectAllStrings(item, [...path, `[${index}]`]));
		});
	}
	else if (typeof obj === "object" && obj !== null) {
		for (const key in obj) {
			result.push(...collectAllStrings((obj as Record<string, unknown>)[key], [...path, key]));
		}
	}

	return result;
}

/**
 * Check if a character is an emoji by testing it against the known emoji set.
 * We use the emoji segmenter to properly handle multi-codepoint emojis (ZWJ sequences, flags, etc.)
 */
function findEmojisInString(text: string): string[] {
	const found: string[] = [];
	// Use the Intl.Segmenter with grapheme granularity to properly segment emojis
	const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
	for (const segment of segmenter.segment(text)) {
		if (allEmojis.has(segment.segment)) {
			found.push(segment.segment);
		}
	}
	return found;
}

describe("Translation files should not contain emoji characters", () => {
	it("should list available languages", () => {
		expect(existsSync(LANG_DIR)).toBe(true);
	});

	it("should not contain any Unicode emoji in any language file", async () => {
		const languages = (await readdir(LANG_DIR, { withFileTypes: true }))
			.filter(entry => entry.isDirectory())
			.map(entry => entry.name);

		expect(languages.length).toBeGreaterThan(0);

		const violations: { lang: string; file: string; key: string; emoji: string; text: string }[] = [];

		for (const lang of languages) {
			const langPath = join(LANG_DIR, lang);
			const files = (await readdir(langPath)).filter(f => f.endsWith(".json"));

			for (const file of files) {
				const content = JSON.parse(await readFile(join(langPath, file), "utf-8"));
				const allStrings = collectAllStrings(content);

				for (const entry of allStrings) {
					const emojis = findEmojisInString(entry.value);
					if (emojis.length > 0) {
						violations.push({
							lang,
							file,
							key: entry.path,
							emoji: emojis.join(" "),
							text: entry.value.length > 80 ? `${entry.value.substring(0, 80)}...` : entry.value
						});
					}
				}
			}
		}

		if (violations.length > 0) {
			const report = violations
				.map(v => `  ${v.lang}/${v.file} → ${v.key}: found ${v.emoji} in "${v.text}"`)
				.join("\n");
			expect.fail(
				`Found ${violations.length} emoji(s) in translation files. ` +
				`Use {emote:path.to.icon} syntax instead:\n${report}`
			);
		}
	});
});
