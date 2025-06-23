import {
	CommandUpdatePacketReq, CommandUpdatePacketRes
} from "../../../../Lib/src/packets/commands/CommandUpdatePacket";
import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCache } from "../../bot/DiscordCache";

/**
 * Shows the current version of the bot
 */
function getPacket(): CommandUpdatePacketReq {
	return makePacket(CommandUpdatePacketReq, {});
}

export async function handleCommandUpdatePacketRes(packet: CommandUpdatePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:update.title", { lng }))
				.setDescription(i18n.t("commands:update.description", {
					coreVersion: packet.coreVersion,
					discordModuleVersion: process.env.npm_package_version,
					lng
				}))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("update"),
	getPacket,
	mainGuildCommand: false
};
