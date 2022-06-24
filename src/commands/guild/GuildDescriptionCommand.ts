import {CommandInteraction} from "discord.js";
import {Entity} from "../../core/models/Entity";
import {replyErrorMessage, sendErrorMessage} from "../../core/utils/ErrorUtils";
import Guild, {Guilds} from "../../core/models/Guild";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {ICommand} from "../ICommand";
import {SlashCommandBuilder} from "@discordjs/builders";
import {Constants} from "../../core/Constants";
import {checkNameString} from "../../core/utils/StringUtils";
import {TranslationModule, Translations} from "../../core/Translations";
import {DraftBotValidateReactionMessage} from "../../core/messages/DraftBotValidateReactionMessage";
import {BlockingUtils} from "../../core/utils/BlockingUtils";
import {BlockingConstants} from "../../core/constants/BlockingConstants";

/**
 * Create validation message to change guild description
 * @param entity
 * @param guild
 * @param askedDescription - New description asked by the user
 * @param interaction - Discord Object
 * @param guildDescriptionModule
 */
function endCallbackGuildCreateValidationMessage(
	entity: Entity,
	guild: Guild,
	askedDescription: string,
	interaction: CommandInteraction,
	guildDescriptionModule: TranslationModule): (validateMessage: DraftBotValidateReactionMessage) => Promise<void> {
	return async (validateMessage: DraftBotValidateReactionMessage) => {
		BlockingUtils.unblockPlayer(entity.discordUserId, BlockingConstants.REASONS.GUILD_DESCRIPTION);
		if (validateMessage.isValidated()) {
			guild.guildDescription = askedDescription;
			await Promise.all([
				entity.save(),
				entity.Player.save(),
				guild.save()
			]);

			interaction.followUp({
				embeds: [new DraftBotEmbed()
					.formatAuthor(guildDescriptionModule.get("changeDescriptionTitle"), interaction.user)
					.setDescription(guildDescriptionModule.get("descriptionChanged"))]
			});
			return;
		}

		// Cancel the creation
		sendErrorMessage(interaction.user, interaction, guildDescriptionModule.language, guildDescriptionModule.get("editCancelled"), true);
	};
}

/**
 * Create validation message to change guild description
 * @param interaction
 * @param endCallback - Function called when user respond to validation message
 * @param askedDescription - The description asked by the user
 * @param entity
 * @param guildDescriptionModule
 */
async function createValidationEmbedGuildDesc(
	interaction: CommandInteraction,
	endCallback: (validateMessage: DraftBotValidateReactionMessage) => Promise<void>,
	askedDescription: string,
	entity: Entity,
	guildDescriptionModule: TranslationModule
): Promise<void> {
	await new DraftBotValidateReactionMessage(interaction.user, endCallback)
		.formatAuthor(guildDescriptionModule.get("changeDescriptionTitle"), interaction.user)
		.setDescription(
			guildDescriptionModule.format("changeDescriptionConfirm",
				{
					description: askedDescription
				}
			))
		.setFooter(guildDescriptionModule.get("changeDescriptionFooter"), null)
		.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(entity.discordUserId, BlockingConstants.REASONS.GUILD_DESCRIPTION, collector));

}

/**
 * Change guild description
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param entity
 */
async function executeCommand(interaction: CommandInteraction, language: string, entity: Entity): Promise<void> {
	const guild = await Guilds.getById(entity.Player.guildId);
	const guildDescriptionModule = Translations.getModule("commands.guildDescription", language);

	const guildDescription = interaction.options.getString("description");

	if (!checkNameString(guildDescription, Constants.GUILD.MIN_DESCRIPTION_LENGTH, Constants.GUILD.MAX_DESCRIPTION_LENGTH)) {
		replyErrorMessage(
			interaction,
			language,
			guildDescriptionModule.format("invalidDescription", {
				min: Constants.GUILD.MIN_DESCRIPTION_LENGTH,
				max: Constants.GUILD.MAX_DESCRIPTION_LENGTH
			})
		);
		return;
	}

	const endCallback = endCallbackGuildCreateValidationMessage(entity, guild, guildDescription, interaction, guildDescriptionModule);

	await createValidationEmbedGuildDesc(interaction, endCallback, guildDescription, entity, guildDescriptionModule);

}

export const commandInfo: ICommand = {
	slashCommandBuilder: new SlashCommandBuilder()
		.setName("guilddesc")
		.setDescription("Change guild description")
		.addStringOption(option => option.setName("description")
			.setDescription("The new description")
			.setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		allowEffects: null,
		requiredLevel: null,
		disallowEffects: [Constants.EFFECT.BABY, Constants.EFFECT.DEAD],
		guildPermissions: 2,
		guildRequired: true,
		userPermission: null
	},
	mainGuildCommand: false,
	slashCommandPermissions: null
};