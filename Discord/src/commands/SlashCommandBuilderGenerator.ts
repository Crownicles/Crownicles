/**
 * Special class for generating SlashCommandBuilder
 */
import {
	ApplicationCommandOptionBase, SlashCommandBuilder, SlashCommandSubcommandBuilder
} from "@discordjs/builders";
import i18n from "../translations/i18n";
import { LANGUAGE } from "../../../Lib/src/Language";

export class SlashCommandBuilderGenerator {
	/**
	 * This is used to avoid having to write the same code for each command this method create a base command with a name and a description from the translation modules of the command
	 * @param commandSectionName Command section name in the translation files
	 */
	static generateBaseCommand(commandSectionName: string): SlashCommandBuilder {
		const nameKey = `discordBuilder:${commandSectionName}.name`;
		const descriptionKey = `discordBuilder:${commandSectionName}.description`;
		const frenchDescription = i18n.t(descriptionKey, {
			lng: LANGUAGE.FRENCH,
			defaultValue: commandSectionName
		});
		const englishName = i18n.t(nameKey, { lng: LANGUAGE.ENGLISH });
		const frenchName = i18n.t(nameKey, { lng: LANGUAGE.FRENCH });

		return new SlashCommandBuilder()
			.setName(englishName)
			.setNameLocalizations({
				fr: frenchName
			})
			.setDescription(i18n.t(descriptionKey, {
				lng: LANGUAGE.ENGLISH,
				defaultValue: frenchDescription
			}))
			.setDescriptionLocalizations({
				fr: frenchDescription
			});
	}

	static generateSubCommand(commandSectionName: string, subCommandSectionName: string): SlashCommandSubcommandBuilder {
		const nameKey = `discordBuilder:${commandSectionName}.subcommands.${subCommandSectionName}.name`;
		const englishName = i18n.t(nameKey, { lng: LANGUAGE.ENGLISH });
		const frenchName = i18n.t(nameKey, { lng: LANGUAGE.FRENCH });

		return new SlashCommandSubcommandBuilder()
			.setName(englishName)
			.setNameLocalizations({
				fr: frenchName
			})
			.setDescription(i18n.t(`discordBuilder:${commandSectionName}.subcommands.${subCommandSectionName}.description`, { lng: LANGUAGE.ENGLISH }))
			.setDescriptionLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.subcommands.${subCommandSectionName}.description`, { lng: LANGUAGE.FRENCH })
			});
	}

	/**
	 * Generate a generic option
	 * @param commandSectionName Command section name in the translation files
	 * @param optionSectionName Option section name in the translation files
	 * @param option Option to populate
	 */
	static generateOption<T extends ApplicationCommandOptionBase>(commandSectionName: string, optionSectionName: string, option: T): T {
		const nameKey = `discordBuilder:${commandSectionName}.options.${optionSectionName}.name`;
		const englishName = i18n.t(nameKey, { lng: LANGUAGE.ENGLISH });
		const frenchName = i18n.t(nameKey, { lng: LANGUAGE.FRENCH });

		return option.setName(englishName)
			.setNameLocalizations({
				fr: frenchName
			})
			.setDescription(i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.description`, { lng: LANGUAGE.ENGLISH }))
			.setDescriptionLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.description`, { lng: LANGUAGE.FRENCH })
			});
	}
}
