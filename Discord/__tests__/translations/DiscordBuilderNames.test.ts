import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { SlashCommandBuilderGenerator } from "../../src/commands/SlashCommandBuilderGenerator";
import { HelpConstants } from "../../../Lib/src/constants/HelpConstants";

const LANG_DIR = resolve(__dirname, "../../../Lang");

// Discord's naming rule for commands and options: https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-naming
const DISCORD_NAME_PATTERN = /^[-_\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}]{1,32}$/u;

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

	// Discord only registers the English names with their French localization, and rejects the whole command list on a single invalid name
	for (const lang of ["en", "fr"]) {
		it(`should only have names accepted by Discord in ${lang}`, () => {
			const names = findAllNameFields(JSON.parse(readFileSync(resolve(LANG_DIR, lang, "discordBuilder.json"), "utf8")));

			expect(names.filter(name => !DISCORD_NAME_PATTERN.test(name.value))).toEqual([]);
		});
	}

	it("should register the pet nickname command under its historical name (#4864)", () => {
		const command = SlashCommandBuilderGenerator.generateBaseCommand("petNick").toJSON();

		expect(command.name).toBe("petnickname");
		expect(command.name_localizations?.fr).toBe("surnomfamilier");
	});

	// Mentions are resolved against the registered (English) names: a mismatch renders "COMMAND NOT FOUND" (#4864)
	it("should only mention registered commands in /help and in the French translations", () => {
		const frenchBuilder: Record<string, unknown> = JSON.parse(readFileSync(resolve(LANG_DIR, "fr", "discordBuilder.json"), "utf8"));
		const registeredNames = new Set(Object.keys(frenchBuilder).map(section => SlashCommandBuilderGenerator.generateBaseCommand(section).toJSON().name));

		const frenchMentions = readdirSync(resolve(LANG_DIR, "fr"))
			.flatMap(file => [...readFileSync(resolve(LANG_DIR, "fr", file), "utf8").matchAll(/\{command:([^} ]+)/gu)]
				.map(match => match[1]));
		const helpNames = Object.values(HelpConstants.COMMANDS_DATA).map(command => command.NAME.split(" ")[0]);

		expect([...new Set([...frenchMentions, ...helpNames])].filter(name => !registeredNames.has(name))).toEqual([]);
	});
});
