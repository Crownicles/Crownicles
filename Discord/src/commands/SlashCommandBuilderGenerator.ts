/**
 * Special class for generating SlashCommandBuilder
 */
import {
	ApplicationCommandOptionBase, SlashCommandBuilder, SlashCommandSubcommandBuilder
} from "@discordjs/builders";
import { InteractionContextType } from "discord-api-types/v10";
import i18n from "../translations/i18n";
import { LANGUAGE } from "../../../Lib/src/Language";


export class SlashCommandBuilderGenerator {
	/**
	 * This is used to avoid having to write the same code for each command this method create a base command with a name and a description from the translation modules of the command
	 *
	 * By default, generated commands are restricted to the Guild context only
	 * (not invokable in DMs nor private group chats). Commands that should be
	 * available in DMs must explicitly call `.setContexts(...)` after this
	 * generator (see HelpCommand).
	 * @param commandSectionName Command section name in the translation files
	 */
	static generateBaseCommand(commandSectionName: string): SlashCommandBuilder {
		return new SlashCommandBuilder()
			.setName(i18n.t(`discordBuilder:${commandSectionName}.name`, { lng: LANGUAGE.ENGLISH }))
			.setNameLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.name`, { lng: LANGUAGE.FRENCH })
			})
			.setDescription(i18n.t(`discordBuilder:${commandSectionName}.description`, { lng: LANGUAGE.ENGLISH }))
			.setDescriptionLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.description`, { lng: LANGUAGE.FRENCH })
			})
			.setContexts(InteractionContextType.Guild) as SlashCommandBuilder;
	}

	static generateSubCommand(commandSectionName: string, subCommandSectionName: string): SlashCommandSubcommandBuilder {
		return new SlashCommandSubcommandBuilder()
			.setName(i18n.t(`discordBuilder:${commandSectionName}.subcommands.${subCommandSectionName}.name`, { lng: LANGUAGE.ENGLISH }))
			.setNameLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.subcommands.${subCommandSectionName}.name`, { lng: LANGUAGE.FRENCH })
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
		return option.setName(i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.name`, { lng: LANGUAGE.ENGLISH }))
			.setNameLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.name`, { lng: LANGUAGE.FRENCH })
			})
			.setDescription(i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.description`, { lng: LANGUAGE.ENGLISH }))
			.setDescriptionLocalizations({
				fr: i18n.t(`discordBuilder:${commandSectionName}.options.${optionSectionName}.description`, { lng: LANGUAGE.FRENCH })
			});
	}
}
