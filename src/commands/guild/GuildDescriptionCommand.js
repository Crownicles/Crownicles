import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";

module.exports.commandInfo = {
	name: "guilddescription",
	aliases: ["gdesc", "guilddesc"],
	disallowEffects: [EFFECT.BABY, EFFECT.DEAD],
	guildRequired: true,
	guildPermissions: 2
};

/**
 * Change guild description
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
const GuildDescriptionCommand = async (message, language, args) => {
	let [entity] = await Entities.getOrRegister(message.author.id);
	let guild = await Guilds.getById(entity.Player.guildId);
	const confirmationEmbed = new DraftBotEmbed();

	if (args.length <= 0) {
		// no description was given
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			format(
				JsonReader.commands.guildDescription.getTranslation(language)
					.noDescriptionGiven
			)
		);
	}

	const description = args.join(" ");
	const regexAllowed = RegExp(
		/^[A-Za-z0-9 ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû"',.;:?!]+$/
	);
	const regexSpecialCases = RegExp(/^[0-9 ]+$|( {2})+/);
	if (
		!(
			regexAllowed.test(description) &&
			!regexSpecialCases.test(description) &&
			description.length >= GUILD.MIN_DESCRIPTION_LENGTH &&
			description.length <= GUILD.MAX_DESCRIPTION_LENGTH
		)
	) {
		// name does not follow the rules
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			format(
				JsonReader.commands.guildDescription.getTranslation(language)
					.invalidDescription,
				{
					min: GUILD.MIN_DESCRIPTION_LENGTH,
					max: GUILD.MAX_DESCRIPTION_LENGTH
				}
			)
		);
	}

	confirmationEmbed.formatAuthor(JsonReader.commands.guildDescription.getTranslation(language).changeDescriptionTitle, message.author);
	confirmationEmbed.setDescription(
		format(
			JsonReader.commands.guildDescription.getTranslation(language)
				.changeDescriptionConfirm,
			{
				description: description
			}
		)
	);
	confirmationEmbed.setFooter(
		JsonReader.commands.guildDescription.getTranslation(language)
			.changeDescriptionFooter,
		null
	);

	const msg = await message.channel.send(confirmationEmbed);

	const embed = new DraftBotEmbed();
	const filterConfirm = (reaction, user) =>
		(reaction.emoji.name === MENU_REACTION.ACCEPT ||
				reaction.emoji.name === MENU_REACTION.DENY) &&
			user.id === message.author.id
		;

	const collector = msg.createReactionCollector(filterConfirm, {
		time: COLLECTOR_TIME,
		max: 1
	});

	addBlockedPlayer(entity.discordUserId, "descriptionEdit", collector);

	collector.on("end", async (reaction) => {
		removeBlockedPlayer(entity.discordUserId);
		if (reaction.first()) {
			// a reaction exist
			if (reaction.first().emoji.name === MENU_REACTION.ACCEPT) {
				[entity] = await Entities.getOrRegister(message.author.id);
				try {
					guild = await Guilds.getById(entity.Player.guildId);
				}
				catch (error) {
					guild = null;
				}
				if (guild === null) {
					// guild is destroy
					return sendErrorMessage(
						message.author,
						message.channel,
						language,
						JsonReader.commands.guildDescription.getTranslation(language)
							.guildDestroy
					);
				}
				guild.guildDescription = args.join(" ");

				await Promise.all([guild.save()]);

				embed.setAuthor(
					format(
						JsonReader.commands.guildDescription.getTranslation(language)
							.editSuccessTitle
					),
					message.author.displayAvatarURL()
				);
				return message.channel.send(embed);
			}
		}

		// Cancel the creation
		return sendErrorMessage(
			message.author,
			message.channel,
			language,
			format(
				JsonReader.commands.guildDescription.getTranslation(language)
					.editCancelled
			)
		);
	});

	await Promise.all([
		msg.react(MENU_REACTION.ACCEPT),
		msg.react(MENU_REACTION.DENY)
	]);
};

module.exports.execute = GuildDescriptionCommand;