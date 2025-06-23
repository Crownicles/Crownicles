import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";

/**
 * Access information about badges
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<null> {
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:badges.title", { lng }))
				.setDescription(i18n.t("commands:badges.description", { lng }))
		]
	});
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("badges"),
	getPacket,
	mainGuildCommand: false
};
