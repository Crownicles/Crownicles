import {
	describe, expect, it
} from "vitest";
import {
	readFileSync, readdirSync
} from "fs";
import { resolve } from "path";
import { HelpConstants } from "../../../../Lib/src/constants/HelpConstants";

const COMMANDS_DIR = resolve(__dirname, "../../../src/commands");
const LANG_DIR = resolve(__dirname, "../../../../Lang");
const ADMIN_COMMANDS_DIR = "admin";
const BASE_COMMAND_PATTERN = /generateBaseCommand\("([^"]+)"\)/gu;

/**
 * Get the builder keys of the commands every player can run: admin commands are not listed in /help
 */
function getPlayerCommandKeys(): string[] {
	return readdirSync(COMMANDS_DIR, {
		recursive: true,
		encoding: "utf8"
	})
		.filter(file => file.endsWith(".ts") && !file.startsWith(ADMIN_COMMANDS_DIR))
		.map(file => readFileSync(resolve(COMMANDS_DIR, file), "utf8"))
		.flatMap(source => [...source.matchAll(BASE_COMMAND_PATTERN)].map(match => match[1]));
}

describe("/help command coverage", () => {
	it("should list every player command", () => {
		const englishBuilder: Record<string, { name: string } | undefined> = JSON.parse(readFileSync(resolve(LANG_DIR, "en", "discordBuilder.json"), "utf8"));
		const helpNames = new Set(Object.values(HelpConstants.COMMANDS_DATA).map(command => command.NAME.split(" ")[0]));

		// Like SlashCommandBuilderGenerator: a command Crowdin has not translated yet is registered under its section name
		expect(getPlayerCommandKeys().filter(key => !helpNames.has(englishBuilder[key]?.name ?? key.toLowerCase()))).toEqual([]);
	});

	it("should have search words and a French description for every listed command", () => {
		const frenchHelp: Record<string, unknown> = JSON.parse(readFileSync(resolve(LANG_DIR, "fr", "commands.json"), "utf8")).help.commands;

		for (const commandKey of Object.keys(HelpConstants.COMMANDS_DATA)) {
			expect(HelpConstants.ACCEPTED_SEARCH_WORDS, commandKey).toHaveProperty(commandKey);
			expect(frenchHelp, commandKey).toHaveProperty(`${commandKey}.description`);
		}
	});
});
