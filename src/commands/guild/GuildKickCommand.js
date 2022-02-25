import {Entities} from "../../core/models/Entity";

module.exports.commandInfo = {
	name: "guildkick",
	aliases: ["gkick", "gk"],
	disallowEffects: [EFFECT.BABY, EFFECT.DEAD],
	guildRequired: true,
	guildPermissions: 3
};

/**
 * Allow to kick a member from a guild
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
import {DraftBotValidateReactionMessage} from "../../core/messages/DraftBotValidateReactionMessage";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {Guilds} from "../../core/models/Guild";
import {MissionsController} from "../../core/missions/MissionsController";
import {BlockingUtils} from "../../core/utils/BlockingUtils";

const GuildKickCommand = async (message, language, args) => {
	const [entity] = await Entities.getOrRegister(message.author.id);
	let kickedEntity;
	const guild = await Guilds.getById(entity.Player.guildId);
	let kickedGuild;

	try {
		[kickedEntity] = await Entities.getByArgs(args, message);
	}
	catch (error) {
		kickedEntity = null;
	}

	if (kickedEntity === null) {
		// no user provided
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			JsonReader.commands.guildKick.getTranslation(language).cannotGetKickedUser
		);
	}

	if (await sendBlockedError(kickedEntity, message.channel, language)) {
		return;
	}

	// search for a user's guild
	try {
		kickedGuild = await Guilds.getById(kickedEntity.Player.guildId);
	}
	catch (error) {
		kickedGuild = null;
	}

	if (kickedGuild === null || kickedGuild.id !== guild.id) {
		// not the same guild
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			JsonReader.commands.guildKick.getTranslation(language).notInTheGuild
		);
	}

	if (kickedEntity.id === entity.id) {
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			JsonReader.commands.guildKick.getTranslation(language).excludeHimself
		);
	}

	const endCallback = async (validateMessage) => {
		BlockingUtils.unblockPlayer(entity.discordUserId);
		if (validateMessage.isValidated()) {
			try {
				[kickedEntity] = await Entities.getByArgs(args, message);
				kickedGuild = await Guilds.getById(kickedEntity.Player.guildId);
			}
			catch (error) {
				kickedEntity = null;
				kickedGuild = null;
			}

			if (kickedGuild === null || kickedEntity === null) {
				// not the same guild
				return sendErrorMessage(
					message.author,
					message.channel,
					language,
					JsonReader.commands.guildKick.getTranslation(language).notInTheGuild
				);
			}
			kickedEntity.Player.guildId = null;
			if (guild.elderId === kickedEntity.id) {
				guild.elderId = null;
			}

			await Promise.all([guild.save(), kickedEntity.save(), kickedEntity.Player.save()]);

			const embed = new DraftBotEmbed();
			embed.setAuthor(
				format(
					JsonReader.commands.guildKick.getTranslation(language).successTitle,
					{
						kickedPseudo: await kickedEntity.Player.getPseudo(language),
						guildName: guild.name
					}
				)
			);
			embed.setDescription(
				JsonReader.commands.guildKick.getTranslation(language).kickSuccess
			);
			await MissionsController.update(kickedEntity.discordUserId, message.channel, language, "guildLevel", 0, null, true);
			return message.channel.send({ embeds: [embed] });
		}

		// Cancel the kick
		return sendErrorMessage(message.author, message.channel, language,
			format(JsonReader.commands.guildKick.getTranslation(language).kickCancelled, {kickedPseudo: await kickedEntity.Player.getPseudo(language)}), true);
	};

	await new DraftBotValidateReactionMessage(
		message.author,
		endCallback
	)
		.formatAuthor(JsonReader.commands.guildKick.getTranslation(language).kickTitle, message.author)
		.setDescription(format(JsonReader.commands.guildKick.getTranslation(language).kick, {
			guildName: guild.name,
			kickedPseudo: await kickedEntity.Player.getPseudo(language)
		}))
		.send(message.channel, (collector) => BlockingUtils.blockPlayerWithCollector(entity.discordUserId, "guildKick", collector));
};

module.exports.execute = GuildKickCommand;