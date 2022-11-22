import {BlockingUtils} from "../../core/utils/BlockingUtils";
import {ICommand} from "../ICommand";
import {SlashCommandBuilder} from "@discordjs/builders";
import {Constants} from "../../core/Constants";
import {CommandInteraction} from "discord.js";
import {Translations} from "../../core/Translations";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {Players} from "../../core/database/game/models/Player";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";

const currentCommandEnglishTranslations = Translations.getModule("commands.unblock", Constants.LANGUAGE.ENGLISH);

/**
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 */
async function executeCommand(interaction: CommandInteraction, language: string): Promise<void> {
	const idToUnblock = interaction.options.get(currentCommandEnglishTranslations.get("optionIdName")).value as string;
	if (!await Players.getByDiscordUserId(idToUnblock)) {
		await interaction.reply({content: "Id unrecognized (is it a message id ?)", ephemeral: true});
		return;
	}
	const blockingReason = await BlockingUtils.getPlayerBlockingReason(idToUnblock);
	if (blockingReason.length === 0) {
		await interaction.reply({content: "Not blocked", ephemeral: true});
		return;
	}
	const unblockModule = Translations.getModule("commands.unblock", language);
	blockingReason.forEach(reason => BlockingUtils.unblockPlayer(idToUnblock, reason));
	await interaction.reply({content: "Unblocked with success", ephemeral: true});
	const [player] = await Players.getOrRegister(idToUnblock);
	const embed = new DraftBotEmbed()
		.setTitle( unblockModule.get("title"))
		.setDescription(unblockModule.get("description"));
	await player.sendNotificationToPlayer(embed, language, interaction.channel);


}

const currentCommandFrenchTranslations = Translations.getModule("commands.unblock", Constants.LANGUAGE.FRENCH);
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand(currentCommandFrenchTranslations, currentCommandEnglishTranslations)
		.addStringOption(option => option.setName(currentCommandEnglishTranslations.get("optionIdName"))
			.setNameLocalizations({
				fr: currentCommandFrenchTranslations.get("optionIdName")
			})
			.setDescription(currentCommandEnglishTranslations.get("optionIdDescription"))
			.setDescriptionLocalizations({
				fr: currentCommandFrenchTranslations.get("optionIdDescription")
			})
			.setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		userPermission: Constants.ROLES.USER.BOT_OWNER
	},
	mainGuildCommand: true
};