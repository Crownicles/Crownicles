import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const MAX_PET_NAME_LENGTH = 100;
const LANG_DIR = resolve(__dirname, "../../../../Lang");

describe("Pet names translations length", () => {
	const languages = readdirSync(LANG_DIR, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	for (const lang of languages) {
		it(`should have all pet names under ${MAX_PET_NAME_LENGTH} characters in ${lang}`, () => {
			const modelsPath = resolve(LANG_DIR, lang, "models.json");
			const models = JSON.parse(readFileSync(modelsPath, "utf8"));
			const pets: Record<string, string> = models.pets;

			const tooLong: string[] = [];
			for (const [key, name] of Object.entries(pets)) {
				if (name.length > MAX_PET_NAME_LENGTH) {
					tooLong.push(`  - pets.${key}: "${name}" (${name.length} chars)`);
				}
			}

			if (tooLong.length > 0) {
				expect(tooLong, `Pet names exceeding ${MAX_PET_NAME_LENGTH} chars in ${lang}:\n${tooLong.join("\n")}`).toHaveLength(0);
			}
		});
	}
});
