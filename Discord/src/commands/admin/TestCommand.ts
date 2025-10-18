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
	GuildTextBasedChannel,
	HexColorString
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";
import { crowniclesClient } from "../../bot/CrowniclesShard";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

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

	if (interaction) {
		if (packet.isError) {
			if (interaction.replied) {
				await interaction.channel.send({ content: packet.result });
			}
			else {
				await interaction.editReply({ content: packet.result });
			}
		}
		else {
			const attachments = packet.fileName && packet.fileContentBase64 ? [new AttachmentBuilder(Buffer.from(packet.fileContentBase64, "base64")).setName(packet.fileName)] : [];
			const embedTestSuccessful = new CrowniclesEmbed()
				.setAuthor({
					name: `Commande test ${packet.commandName} exécutée :`,
					iconURL: interaction.user.displayAvatarURL()
				})
				.setDescription(packet.result)
				.setColor(<HexColorString> ColorConstants.SUCCESSFUL);

			const payload = attachments.length > 0
				? {
					embeds: [embedTestSuccessful],
					files: attachments
				}
				: {
					embeds: [embedTestSuccessful]
				};

			if (interaction.replied) {
				await interaction.channel.send(payload);
			}
			else {
				await interaction.editReply(payload);
			}
		}
	}
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

	const attachments = packet.fileName && packet.fileContentBase64
		? [new AttachmentBuilder(Buffer.from(packet.fileContentBase64, "base64")).setName(packet.fileName)]
		: [];

	const embedTestSuccessful = new CrowniclesEmbed()
		.setAuthor({
			name: `Commande test ${packet.commandName} exécutée :`,
			iconURL: user?.displayAvatarURL()
		})
		.setDescription(packet.result)
		.setColor(<HexColorString> ColorConstants.SUCCESSFUL);

	const payload = attachments.length > 0
		? {
			embeds: [embedTestSuccessful],
			files: attachments
		}
		: {
			embeds: [embedTestSuccessful]
		};

	await textChannel.send(payload).catch((e: unknown) => {
		CrowniclesLogger.errorWithObj("Failed to deliver test command result in fallback", e);
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("test")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("test", "commandName", option)
			.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
