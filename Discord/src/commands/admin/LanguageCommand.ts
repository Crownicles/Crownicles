import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import {
	LANGUAGE, Language
} from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";

/**
 * Change the language used by the bot to interact with the player
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<null> {
	const selectLanguageMenuId = "languageSelectionMenu";
	const lng = interaction.userLanguage;

	const selectLanguageMenuOptions = LANGUAGE.LANGUAGES
		.map(languageCode => new StringSelectMenuOptionBuilder()
			.setLabel(i18n.t(`commands:language.languages.${languageCode}`, { lng }))
			.setEmoji(CrowniclesIcons.languages[languageCode])
			.setValue(languageCode));

	const languageSelectionMenu = new StringSelectMenuBuilder()
		.setCustomId(selectLanguageMenuId)
		.setPlaceholder(i18n.t("commands:language.selectLanguage", { lng }))
		.addOptions(selectLanguageMenuOptions);

	const row = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(languageSelectionMenu);

	const reply = await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:language.title", { lng }))
				.setDescription(i18n.t("commands:language.description", { lng }))
		],
		components: [row],
		withResponse: true
	});

	if (!reply?.resource?.message) {
		return null;
	}

	const msg = reply.resource.message;
	const collector = msg.createMessageComponentCollector({
		filter: menuInteraction => menuInteraction.customId === selectLanguageMenuId,
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	collector.on("collect", async (menuInteraction: StringSelectMenuInteraction) => {
		if (menuInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(menuInteraction.user, menuInteraction, lng);
			return;
		}

		await KeycloakUtils.updateUserLanguage(keycloakConfig, keycloakUser, menuInteraction.values[0] as Language);

		await menuInteraction.reply({
			embeds: [
				new CrowniclesEmbed()
					.setTitle(i18n.t("commands:language.newLanguageSetTitle", {
						lng: menuInteraction.values[0] as Language
					}))
					.setDescription(i18n.t("commands:language.newLanguageSetDescription", {
						lng: menuInteraction.values[0] as Language
					}))
			]
		});

		collector.stop();
	});

	collector.on("end", async () => {
		row.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({ components: [row] });
	});

	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("language"),
	getPacket,
	mainGuildCommand: false
};
