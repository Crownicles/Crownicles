import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandTestPacketReq, CommandTestPacketRes
} from "../../../../Lib/src/packets/commands/CommandTestPacket";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	AttachmentBuilder,
	AutocompleteInteraction,
	GuildTextBasedChannel,
	HexColorString
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";
import { crowniclesClient } from "../../bot/CrowniclesShard";
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

export async function handleCommandTestPacketRes(packet: CommandTestPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		await sendResultWithoutInteraction(packet, context);
		return;
	}

	if (packet.isError) {
		const content = { content: packet.result };
		if (interaction.replied) {
			await interaction.channel.send(content);
		}
		else {
			await interaction.editReply(content);
		}
		return;
	}

	const embed = buildTestResultEmbed(packet.commandName, packet.result, interaction.user.displayAvatarURL());
	const payload = buildPayloadWithAttachments(embed, packet.fileName, packet.fileContentBase64);

	if (interaction.replied) {
		await interaction.channel.send(payload);
	}
	else {
		await interaction.editReply(payload);
	}
}

/**
 * Build test command result embed
 */
function buildTestResultEmbed(commandName: string, result: string, userAvatarUrl?: string): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.setAuthor({
			name: `Commande test ${commandName} exécutée :`,
			iconURL: userAvatarUrl
		})
		.setDescription(result)
		.setColor(<HexColorString> ColorConstants.SUCCESSFUL);
}

/**
 * Build payload with optional file attachments
 */
function buildPayloadWithAttachments(embed: CrowniclesEmbed, fileName?: string, fileContentBase64?: string): {
	embeds: CrowniclesEmbed[];
	files?: AttachmentBuilder[];
} {
	const attachments = fileName && fileContentBase64
		? [new AttachmentBuilder(Buffer.from(fileContentBase64, "base64")).setName(fileName)]
		: [];

	return attachments.length > 0
		? {
			embeds: [embed],
			files: attachments
		}
		: {
			embeds: [embed]
		};
}

async function sendResultWithoutInteraction(packet: CommandTestPacketRes, context: PacketContext): Promise<void> {
	const channelId = context.discord?.channel;
	if (!channelId) {
		CrowniclesLogger.warn("Command test result without context channel");
		return;
	}

	if (!crowniclesClient?.isReady()) {
		CrowniclesLogger.warn("Discord client not ready to deliver command test result");
		return;
	}

	const channel = await crowniclesClient.channels.fetch(channelId).catch(e => {
		CrowniclesLogger.errorWithObj("Unable to fetch channel for test command result", e);
		return null;
	});

	if (!channel || !channel.isTextBased()) {
		CrowniclesLogger.warn(`Channel ${channelId} unavailable for test command result`);
		return;
	}

	const textChannel = channel as GuildTextBasedChannel;

	if (packet.isError) {
		await textChannel.send({ content: packet.result }).catch((e: unknown) => {
			CrowniclesLogger.errorWithObj("Failed to deliver test command error result", e);
		});
		return;
	}

	const userId = context.discord?.user;
	const user = userId
		? await crowniclesClient.users.fetch(userId).catch(() => null)
		: null;

	const embed = buildTestResultEmbed(packet.commandName, packet.result, user?.displayAvatarURL());
	const payload = buildPayloadWithAttachments(embed, packet.fileName, packet.fileContentBase64);

	await textChannel.send(payload).catch((e: unknown) => {
		CrowniclesLogger.errorWithObj("Failed to deliver test command result in fallback", e);
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
