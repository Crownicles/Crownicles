import {
	AttachmentBuilder, GuildTextBasedChannel, HexColorString
} from "discord.js";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../Lib/src/packets/commands/CommandTestPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";
import { crowniclesClient } from "../../bot/CrowniclesShard";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export async function handleCommandTestPacketRes(packet: CommandTestPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		await sendResultWithoutInteraction(packet, context);
		return;
	}

	const payload = buildTestResultPayload(packet, interaction.user.displayAvatarURL());
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
function buildTestResultEmbed(packet: CommandTestPacketRes, userAvatarUrl?: string): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.setAuthor({
			name: `Commande test ${packet.commandName} exécutée :`,
			iconURL: userAvatarUrl
		})
		.setDescription(packet.result)
		.setColor(<HexColorString> ColorConstants.SUCCESSFUL);
}

/**
 * Build the message of a test command result. A failure is an embed and not a content: a city menu answered with
 * the same packets turns the reply into components V2, which refuse a content
 */
function buildTestResultPayload(packet: CommandTestPacketRes, userAvatarUrl?: string): ReturnType<typeof buildPayloadWithAttachments> {
	if (packet.isError) {
		return {
			embeds: [
				new CrowniclesEmbed().setDescription(packet.result)
					.setErrorColor()
			]
		};
	}
	return buildPayloadWithAttachments(buildTestResultEmbed(packet, userAvatarUrl), packet.fileName, packet.fileContentBase64);
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
		: { embeds: [embed] };
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

	const userId = context.discord?.user;
	const user = userId
		? await crowniclesClient.users.fetch(userId).catch(() => null)
		: null;

	await textChannel.send(buildTestResultPayload(packet, user?.displayAvatarURL())).catch((e: unknown) => {
		CrowniclesLogger.errorWithObj("Failed to deliver test command result in fallback", e);
	});
}
