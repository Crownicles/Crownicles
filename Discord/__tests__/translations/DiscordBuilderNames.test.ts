import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const LANG_DIR = resolve(__dirname, "../../../Lang");

/**
 * Recursively find all "name" fields in the discordBuilder JSON structure.
 * Returns an array of { path, value } for each "name" field found.
 */
function findAllNameFields(obj: unknown, path = ""): { path: string; value: string }[] {
	const results: { path: string; value: string }[] = [];
	if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
		for (const [key, val] of Object.entries(obj)) {
			if (key === "name" && typeof val === "string") {
				results.push({ path: path ? `${path}.name` : "name", value: val });
			}
			else {
				results.push(...findAllNameFields(val, path ? `${path}.${key}` : key));
			}
		}
	}
	return results;
}

describe("DiscordBuilder translations", () => {
	const languages = readdirSync(LANG_DIR, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	for (const lang of languages) {
		it(`should have all "name" fields in lowercase in ${lang}`, () => {
			const filePath = resolve(LANG_DIR, lang, "discordBuilder.json");
			const data = JSON.parse(readFileSync(filePath, "utf8"));
			const names = findAllNameFields(data);

			const withCaps = names.filter(n => n.value !== n.value.toLowerCase());

			if (withCaps.length > 0) {
				const details = withCaps.map(n => `  - ${n.path}: "${n.value}" (should be "${n.value.toLowerCase()}")`).join("\n");
				expect(withCaps, `Discord slash command "name" fields must be lowercase in ${lang}:\n${details}`).toHaveLength(0);
			}
		});
	}
});
