import { ICommand } from "../ICommand";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CommandTestPacketReq } from "../../../../Lib/src/packets/commands/CommandTestPacket";
import { SlashCommandBuilder } from "@discordjs/builders";
import { AutocompleteInteraction } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { TestCommandsCache } from "../../packetHandlers/handlers/commands/CommandTestListPacketHandler";
import {
	searchAutocomplete, toDiscordChoices
} from "../../utils/AutocompleteUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandTestPacketReq> {
	const commandName = interaction.options.get("command");
	await interaction.deferReply();
	return makePacket(CommandTestPacketReq, {
		keycloakId: user.id,
		command: commandName ? commandName.value as string : undefined
	});
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
	try {
		const focusedValue = interaction.options.getFocused();

		// Check if we have test commands cached
		if (!TestCommandsCache.hasCommands()) {
			CrowniclesLogger.warn("Test commands not yet loaded for autocomplete");
			await interaction.respond([]);
			return;
		}

		// Convert cached test commands to searchable items
		const testCommands = TestCommandsCache.getCommands().map(cmd => ({
			key: cmd.name,
			displayName: cmd.name,
			aliases: cmd.aliases && cmd.aliases.length > 0 ? cmd.aliases : [cmd.name]
		}));

		const results = searchAutocomplete(testCommands, focusedValue);
		const choices = toDiscordChoices(results);

		await interaction.respond(choices);
	}
	catch (error) {
		CrowniclesLogger.errorWithObj("Error while handling test autocomplete", error);

		// Respond with empty array to prevent Discord errors
		try {
			await interaction.respond([]);
		}
		catch {
			// Ignore errors from respond fallback
		}
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("test")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("test", "commandName", option)
			.setRequired(false)
			.setAutocomplete(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false,
	handleAutocomplete
};
