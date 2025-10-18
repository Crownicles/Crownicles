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
	HexColorString
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";

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

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("test")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("test", "commandName", option)
			.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
