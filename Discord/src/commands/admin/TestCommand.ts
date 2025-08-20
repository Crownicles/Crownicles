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
import { HexColorString } from "discord.js";
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
			const embedTestSuccessful = new CrowniclesEmbed()
				.setAuthor({
					name: `Commande test ${packet.commandName} exécutée :`,
					iconURL: interaction.user.displayAvatarURL()
				})
				.setDescription(packet.result)
				.setColor(<HexColorString> ColorConstants.SUCCESSFUL);

			if (interaction.replied) {
				await interaction.channel.send({ embeds: [embedTestSuccessful] });
			}
			else {
				await interaction.editReply({ embeds: [embedTestSuccessful] });
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
