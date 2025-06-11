import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";

/**
 * Displays the bot's official server invitation link
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<void> {
	await interaction.reply({ content: i18n.t("commands:invite.discord.main", { lng: interaction.userLanguage }) });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("invite"),
	getPacket,
	mainGuildCommand: false
};
