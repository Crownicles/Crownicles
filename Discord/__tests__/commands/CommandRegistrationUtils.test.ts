import {
	describe, expect, it
} from "vitest";
import { SlashCommandBuilder } from "@discordjs/builders";
import { InteractionContextType } from "discord-api-types/v10";
import { buildCommandRegistrationBody } from "../../src/commands/CommandRegistrationUtils";
import { ICommand } from "../../src/commands/ICommand";
import { commandInfo as helpCommandInfo } from "../../src/commands/player/HelpCommand";
import { commandInfo as guildDailyCommandInfo } from "../../src/commands/guild/GuildDailyCommand";

function fakeCommand(allowedInDM?: boolean): ICommand {
	return {
		slashCommandBuilder: new SlashCommandBuilder()
			.setName("fake")
			.setDescription("fake command"),
		getPacket: () => null,
		mainGuildCommand: false,
		...(allowedInDM === undefined ? {} : { allowedInDM })
	};
}

describe("buildCommandRegistrationBody", () => {
	it("registers commands in the guild context only by default", () => {
		expect(buildCommandRegistrationBody(fakeCommand()).contexts).toEqual([InteractionContextType.Guild]);
		expect(buildCommandRegistrationBody(fakeCommand(false)).contexts).toEqual([InteractionContextType.Guild]);
	});

	it("also registers commands allowed in DM in the bot DM context", () => {
		expect(buildCommandRegistrationBody(fakeCommand(true)).contexts).toEqual([InteractionContextType.Guild, InteractionContextType.BotDM]);
	});

	it("keeps the slash command definition from the builder", () => {
		const body = buildCommandRegistrationBody(fakeCommand(true));

		expect(body.name).toBe("fake");
		expect(body.description).toBe("fake command");
	});

	it("makes /help available in DM while guild commands stay guild-only", () => {
		expect(buildCommandRegistrationBody(helpCommandInfo).contexts).toContain(InteractionContextType.BotDM);
		expect(buildCommandRegistrationBody(guildDailyCommandInfo).contexts).toEqual([InteractionContextType.Guild]);
	});
});
