import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";

async function getPacket(interaction: CrowniclesInteraction): Promise<null> {
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:idea.title", { lng }))
				.setDescription(i18n.t("commands:idea.description", { lng }))
		]
	});
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("idea"),
	getPacket,
	mainGuildCommand: false
};
