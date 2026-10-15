/**
 * Special class for generating SlashCommandBuilder
 */
import {
	ApplicationCommandOptionBase, SlashCommandBuilder, SlashCommandSubcommandBuilder
} from "@discordjs/builders";
import i18n from "../translations/i18n";
import { LANGUAGE } from "../../../Lib/src/Language";

/** Crowdin only translates develop: a name it has not translated yet registers as its key, a translated one exactly as written (#4864) */
function englishNameOf(nameKey: string, sectionName: string): string {
	return i18n.t(nameKey, {
		lng: LANGUAGE.ENGLISH, defaultValue: sectionName.toLowerCase()
	});
}

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
		const englishName = englishNameOf(nameKey, commandSectionName);
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
		const englishName = englishNameOf(nameKey, subCommandSectionName);
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
	 * The name Discord knows an option by: reading it through this keeps working when a translation renames it
	 * @param commandSectionName Command section name in the translation files
	 * @param optionSectionName Option section name in the translation files
	 */
	static optionName(commandSectionName: string, optionSectionName: string): string {
		return englishNameOf(`discordBuilder:${commandSectionName}.options.${optionSectionName}.name`, optionSectionName);
	}

	/**
	 * Generate a generic option
	 * @param commandSectionName Command section name in the translation files
	 * @param optionSectionName Option section name in the translation files
	 * @param option Option to populate
	 */
	static generateOption<T extends ApplicationCommandOptionBase>(commandSectionName: string, optionSectionName: string, option: T): T {
		const englishName = SlashCommandBuilderGenerator.optionName(commandSectionName, optionSectionName);
		const frenchName = i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.name`, { lng: LANGUAGE.FRENCH });

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
