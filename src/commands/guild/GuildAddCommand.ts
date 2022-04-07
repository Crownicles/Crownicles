import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {DraftBotValidateReactionMessage} from "../../core/messages/DraftBotValidateReactionMessage";
import {Entities, Entity} from "../../core/models/Entity";
import Guild, {Guilds} from "../../core/models/Guild";
import {MissionsController} from "../../core/missions/MissionsController";
import {escapeUsername} from "../../core/utils/StringUtils";
import {BlockingUtils, sendBlockedError} from "../../core/utils/BlockingUtils";
import {ICommand} from "../ICommand";
import {Constants} from "../../core/Constants";
import {CommandInteraction, User} from "discord.js";
import {SlashCommandBuilder} from "@discordjs/builders";
import {sendErrorMessage} from "../../core/utils/ErrorUtils";
import {TranslationModule, Translations} from "../../core/Translations";

type InvitedUserInformations = { invitedUser: User, invitedEntity: Entity };
type InviterUserInformations = { guild: Guild, entity: Entity };
type CommandInformations = { interaction: CommandInteraction, language: string };

function getEndCallbackGuildAdd(inviter: InviterUserInformations, invited: InvitedUserInformations, commandInformations: CommandInformations, guildAddModule: TranslationModule) {
	return async (msg: DraftBotValidateReactionMessage) => {
		BlockingUtils.unblockPlayer(invited.invitedEntity.discordUserId);
		if (msg.isValidated()) {
			try {
				inviter.guild = await Guilds.getById(inviter.entity.Player.guildId);
			}
			catch (error) {
				inviter.guild = null;
			}
			if (inviter.guild === null) {
				// guild is destroyed
				return sendErrorMessage(
					invited.invitedUser,
					commandInformations.interaction.channel,
					commandInformations.language,
					guildAddModule.get("guildDestroy")
				);
			}
			invited.invitedEntity.Player.guildId = inviter.guild.id;
			inviter.guild.updateLastDailyAt();

			await Promise.all([
				inviter.guild.save(),
				invited.invitedEntity.save(),
				invited.invitedEntity.Player.save()
			]);

			await MissionsController.update(invited.invitedEntity.discordUserId, commandInformations.interaction.channel, commandInformations.language, "joinGuild");
			await MissionsController.update(invited.invitedEntity.discordUserId, commandInformations.interaction.channel, commandInformations.language, "guildLevel", inviter.guild.level, null, true);

			return commandInformations.interaction.followUp({
				embeds: [
					new DraftBotEmbed()
						.setAuthor(
							guildAddModule.format("successTitle", {
								pseudo: escapeUsername(invited.invitedUser.username),
								guildName: inviter.guild.name
							}),
							invited.invitedUser.displayAvatarURL()
						)
						.setDescription(guildAddModule.get("invitationSuccess"))
				]
			});
		}

		// Cancel the creation
		return sendErrorMessage(invited.invitedUser, commandInformations.interaction.channel, commandInformations.language,
			guildAddModule.format("invitationCancelled", {guildName: inviter.guild.name}), true);
	};
}

/**
 * Allow to add a member to a guild
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 * @param entity
 */
async function executeCommand(interaction: CommandInteraction, language: string, entity: Entity): Promise<void> {
	const guildAddModule = Translations.getModule("commands.guildAdd", language);
	const invitedEntity = await Entities.getByOptions(interaction);
	if (!invitedEntity) {
		// no user provided
		sendErrorMessage(
			interaction.user,
			interaction.channel,
			language,
			guildAddModule.get("cannotGetInvitedUser"),
			false,
			interaction
		);
		return;
	}
	if (invitedEntity.Player.level < Constants.GUILD.REQUIRED_LEVEL) {
		// invited user is low level
		await sendErrorMessage(
			interaction.user,
			interaction.channel,
			language,
			guildAddModule.format("levelTooLow",
				{
					pseudo: invitedEntity.Player.getPseudo(language),
					level: Constants.GUILD.REQUIRED_LEVEL,
					playerLevel: invitedEntity.Player.level,
					comeIn: Constants.GUILD.REQUIRED_LEVEL - invitedEntity.Player.level > 1
						? `${Constants.GUILD.REQUIRED_LEVEL - invitedEntity.Player.level} niveaux`
						: `${Constants.GUILD.REQUIRED_LEVEL - invitedEntity.Player.level} niveau`
				}
			)
		);
		return;
	}

	const invitedUser: User = interaction.options.getUser("user");
	if (await sendBlockedError(invitedUser, interaction.channel, language)) {
		return;
	}

	const guild = await Guilds.getById(entity.Player.guildId);
	// search for the invited's guild
	let invitedGuild;
	try {
		invitedGuild = await Guilds.getById(invitedEntity.Player.guildId);
	}
	catch (error) {
		invitedGuild = null;
	}
	if (invitedGuild !== null) {
		// already in a guild
		sendErrorMessage(
			interaction.user,
			interaction.channel,
			language,
			guildAddModule.get("alreadyInAGuild"),
			false,
			interaction
		);
		return;
	}

	const members = await Entities.getByGuild(guild.id);
	if (members.length === Constants.GUILD.MAX_GUILD_MEMBER) {
		sendErrorMessage(
			interaction.user,
			interaction.channel,
			language,
			guildAddModule.get("guildFull"),
			false,
			interaction
		);
		return;
	}

	const endCallback = getEndCallbackGuildAdd(
		{guild, entity},
		{invitedEntity, invitedUser},
		{interaction, language},
		guildAddModule
	);

	const validationEmbed = new DraftBotValidateReactionMessage(invitedUser, endCallback)
		.formatAuthor(guildAddModule.get("invitationTitle"), invitedUser)
		.setDescription(guildAddModule.format("invitation", {
			guildName: guild.name
		})) as DraftBotValidateReactionMessage;
	await validationEmbed.reply(interaction, (collector) => BlockingUtils.blockPlayerWithCollector(invitedEntity.discordUserId, "guildAdd", collector));
}

export const commandInfo: ICommand = {
	slashCommandBuilder: new SlashCommandBuilder()
		.setName("guildadd")
		.setDescription("Recruit a new member to the guild")
		.addUserOption(option => option.setName("user")
			.setDescription("The user you want to add in your guild")
			.setRequired(false)
		) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		allowEffects: null,
		requiredLevel: null,
		disallowEffects: [Constants.EFFECT.BABY, Constants.EFFECT.DEAD],
		guildPermissions: Constants.GUILD.PERMISSION_LEVEL.ELDER,
		guildRequired: true,
		userPermission: null
	},
	mainGuildCommand: false,
	slashCommandPermissions: null
};