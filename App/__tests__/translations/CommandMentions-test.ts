import i18next from "i18next";
import {i18n} from "@/src/translations/i18n";
import frenchAdvices from "../../../Lang/fr/advices.json";
import frenchApp from "../../../Lang/fr/app.json";

declare const __dirname: string;

const fs = jest.requireActual<{
	readdirSync(directory: string): string[];
	readFileSync(file: string, encoding: "utf8"): string;
}>("node:fs");
const path = jest.requireActual<{join(...paths: string[]): string}>("node:path");

const FRENCH_ROOT = path.join(__dirname, "../../../Lang/fr");
/** Advices are filtered out of the app when they name a command, and the bot texts are never shown there. */
const DISCORD_ONLY_NAMESPACES = ["advices.json", "bot.json"];
const COMMAND_MENTION = /{command:(.*?)}/g;

function mentionedCommands(): Set<string> {
	const commands = new Set<string>();
	for (const file of fs.readdirSync(FRENCH_ROOT).filter(name => name.endsWith(".json") && !DISCORD_ONLY_NAMESPACES.includes(name))) {
		for (const [, command] of fs.readFileSync(path.join(FRENCH_ROOT, file), "utf8").matchAll(COMMAND_MENTION)) {
			commands.add(command);
		}
	}
	return commands;
}

describe("command mentions", () => {
	beforeEach(async () => {
		await i18next.changeLanguage("fr");
	});

	it("names the screen holding the blessings when the Oracle points to them", () => {
		const story = i18n.t("smallEvents:altar.firstEncounter");

		expect(story).toContain("depuis l'onglet Profil, rubrique Bénédictions.");
		expect(story).not.toMatch(/{command:|\/blessing/);
	});

	it("keeps the Discord name of a command the app does not offer", () => {
		i18next.addResource("fr", "app", "commandMentionsTest", "Votez avec {command:vote}.");

		expect(i18n.t("app:commandMentionsTest")).toBe("Votez avec /vote.");
	});

	it("has an app label for every command a text shown in the app can mention", () => {
		const labelled = Object.keys(frenchApp.commandMentions);

		expect([...mentionedCommands()].filter(command => !labelled.includes(command))).toEqual([]);
	});

	it("resolves every app label to the names the screens display", () => {
		const unresolved = Object.keys(frenchApp.commandMentions)
			.map(command => i18n.t(`app:commandMentions.${command}`))
			.filter(label => /\$t\(|\w\.\w/.test(label));

		expect(unresolved).toEqual([]);
	});

	it("leaves out the advices written around a command", () => {
		const advices = i18n.tArrayWithoutCommands("advices:advices");

		expect(advices).toHaveLength(frenchAdvices.advices.filter(advice => !advice.includes("{command:")).length);
		expect(advices.length).toBeGreaterThan(0);
	});
});
