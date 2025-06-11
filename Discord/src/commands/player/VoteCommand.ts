import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";

/**
 * Shows the embed that redirects to the topGG vote page
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<null> {
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:vote.title", { lng }))
				.setDescription(i18n.t("commands:vote.description", { lng }))
		]
	});
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("vote"),
	getPacket,
	mainGuildCommand: false
};
