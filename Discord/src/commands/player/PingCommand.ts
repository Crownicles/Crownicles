import { ICommand } from "../ICommand";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPingPacketReq } from "../../../../Lib/src/packets/commands/CommandPingPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";

/**
 * Pings the bot, to check if it is alive and how well is it
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandPingPacketReq> {
	const packet = makePacket(CommandPingPacketReq, { time: Date.now() });
	await interaction.reply({ content: i18n.t("commands:ping.discord.create", { lng: interaction.userLanguage }) });
	return packet;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("ping"),
	getPacket,
	mainGuildCommand: false
};
