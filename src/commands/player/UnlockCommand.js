import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {Entities} from "../../core/models/Entity";

import {Maps} from "../../core/Maps";
import {BlockingUtils} from "../../core/utils/BlockingUtils";

module.exports.commandInfo = {
	name: "unlock",
	aliases: ["bail","release"],
	allowEffects: EFFECT.SMILEY
};

/**
 * Allow to free someone from the lock effect
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
const UnlockCommand = async (message, language, args) => {
	let [entity] = await Entities.getOrRegister(message.author.id); // Loading player

	if (message.mentions.users.first()) {
		if (message.mentions.users.first().id === message.author.id) {
			return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.unlock.getTranslation(language).unlockHimself);
		}
	}

	const [lockedEntity] = await Entities.getByArgs(args, message);
	if (!lockedEntity) {
		return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.unlock.getTranslation(language).cannotGetlockedUser);
	}

	if (lockedEntity.Player.effect !== EFFECT.LOCKED) {
		return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.unlock.getTranslation(language).userNotLocked);
	}
	if (entity.Player.money < UNLOCK.PRICE_FOR_UNLOCK) {
		return sendErrorMessage(message.author, message.channel, language,
			format(JsonReader.commands.unlock.getTranslation(language).noMoney, {
				money: UNLOCK.PRICE_FOR_UNLOCK - entity.Player.money,
				pseudo: await lockedEntity.Player.getPseudo(language)
			})
		);
	}

	const embed = new DraftBotEmbed()
		.formatAuthor(JsonReader.commands.unlock.getTranslation(language).unlockTitle, message.author)
		.setDescription(format(JsonReader.commands.unlock.getTranslation(language).confirmUnlock, {
			pseudo: await lockedEntity.Player.getPseudo(language),
			price: UNLOCK.PRICE_FOR_UNLOCK
		}));
	const unlockMessage = await message.channel.send({ embeds: [embed] });

	const filter = (reaction, user) => (reaction.emoji.name === MENU_REACTION.ACCEPT || reaction.emoji.name === MENU_REACTION.DENY) && user.id === message.author.id;

	const collector = unlockMessage.createReactionCollector({
		filter,
		time: 30000,
		max: 1
	});

	BlockingUtils.blockPlayerWithCollector(entity.discordUserId, "unlock", collector);

	collector.on("end", async (reaction) => {
		BlockingUtils.unblockPlayer(entity.discordUserId);
		if (reaction.first()) { // a reaction exist
			[entity] = await Entities.getOrRegister(lockedEntity.discordUserId); // released entity
			const [player] = await Entities.getOrRegister(message.author.id); // message author
			if (reaction.first().emoji.name === MENU_REACTION.ACCEPT) {
				await Maps.removeEffect(entity.Player);
				await player.Player.addMoney(player, -UNLOCK.PRICE_FOR_UNLOCK, message.channel, language); // Remove money
				await Promise.all([
					entity.save(),
					entity.Player.save(),
					player.save(),
					player.Player.save()
				]);
				log(entity.discordUserId + " has been released by" + message.author.id);
				const successEmbed = new DraftBotEmbed();
				successEmbed.setAuthor(format(JsonReader.commands.unlock.getTranslation(language).unlockedTitle, {
					pseudo: await entity.Player.getPseudo(language)
				}),
				message.author.displayAvatarURL());
				successEmbed.setDescription(format(JsonReader.commands.unlock.getTranslation(language).unlockSuccess, {
					pseudo: await entity.Player.getPseudo(language)
				}));
				return await message.channel.send({ embeds: [successEmbed] });
			}
		}
		await sendErrorMessage(message.author, message.channel, language, JsonReader.commands.unlock.getTranslation(language).unlockCanceled, true);
	});

	try {
		await Promise.all([
			unlockMessage.react(MENU_REACTION.ACCEPT),
			unlockMessage.react(MENU_REACTION.DENY)
		]);
	}
	catch (e) {
		log("Error while reaction to unlock message: " + e);
	}
};

module.exports.execute = UnlockCommand;
