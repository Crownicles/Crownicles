import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {Classes} from "../../core/models/Class";
import {Entities} from "../../core/models/Entity";
import {MissionsController} from "../../core/missions/MissionsController";
import {BlockingUtils} from "../../core/utils/BlockingUtils";

module.exports.commandInfo = {
	name: "class",
	aliases: ["c", "classes", "classe"],
	allowEffects: EFFECT.SMILEY,
	requiredLevel: CLASS.REQUIRED_LEVEL
};

/**
 * Select a class
 * @param {Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 */
const ClassCommand = async (message, language) => {
	if (await sendBlockedError(message.author, message.channel, language)) {
		return;
	}

	const [entity] = await Entities.getOrRegister(message.author.id); // Loading player
	const classTranslations = JsonReader.commands.class.getTranslation(language);
	const allClasses = await Classes.getByGroupId(entity.Player.getClassGroup());
	const embedClassMessage = new DraftBotEmbed()
		.setTitle(classTranslations.title)
		.setDescription(
			classTranslations.desc);

	for (let k = 0; k < allClasses.length; k++) {
		embedClassMessage.addField(allClasses[k].getName(language),
			format(
				classTranslations.classMainDisplay,
				{
					description: allClasses[k].getDescription(language),
					price: allClasses[k].price
				}
			), false
		);
	}

	embedClassMessage.addField(
		classTranslations.moneyQuantityTitle,
		format(classTranslations.moneyQuantity, {
			money: entity.Player.money
		}));
	// Creating class message
	const classMessage = await message.channel.send({ embeds: [embedClassMessage] });

	const filterConfirm = (reaction, user) => user.id === entity.discordUserId && reaction.me;

	const collector = classMessage.createReactionCollector({ filter: filterConfirm, time: COLLECTOR_TIME, max: 1 });

	BlockingUtils.blockPlayerWithCollector(entity.discordUserId, "class", collector);

	// Fetch the choice from the user
	collector.on("end", async (reaction) => {
		if (!reaction.first()) { // the user is afk
			BlockingUtils.unblockPlayer(entity.discordUserId);
			return;
		}
		if (reaction.first().emoji.name === MENU_REACTION.DENY) {
			BlockingUtils.unblockPlayer(entity.discordUserId);
			sendErrorMessage(message.author, message.channel, language, JsonReader.commands.class.getTranslation(language).error.leaveClass, true);
			return;
		}

		const selectedClass = await Classes.getByEmoji(reaction.first().emoji.name);
		await confirmPurchase(message, language, selectedClass, entity);
	});

	// Adding reactions
	const classEmojis = new Map();
	for (let k = 0; k < allClasses.length; k++) {
		await classMessage.react(allClasses[k].emoji);
		classEmojis.set(allClasses[k].emoji, k);
	}
	classMessage.react(MENU_REACTION.DENY);
};

/**
 * @param {*} message - message where the command is from
 * @param {("fr"|"en")} language - the language that has to be used
 * @param {*} selectedClass - The selected class
 * @param {Entities} entity - The entity that is playing
 */
async function confirmPurchase(message, language, selectedClass, entity) {

	const confirmEmbed = new DraftBotEmbed()
		.formatAuthor(JsonReader.commands.class.getTranslation(language).confirm, message.author)
		.setDescription(
			"\n\u200b\n" +
			format(JsonReader.commands.class.getTranslation(language).display, {
				name: selectedClass.toString(language, entity.Player.level),
				price: selectedClass.price,
				description: selectedClass.getDescription(language)
			})
		);

	const confirmMessage = await message.channel.send({ embeds: [confirmEmbed] });
	const filterConfirm = (reaction, user) => (reaction.emoji.name === MENU_REACTION.ACCEPT || reaction.emoji.name === MENU_REACTION.DENY) && user.id === entity.discordUserId;

	const collector = confirmMessage.createReactionCollector({
		filter: filterConfirm,
		time: COLLECTOR_TIME,
		max: 1
	});

	collector.on("end", async (reaction) => {
		const playerClass = await Classes.getById(entity.Player.class);
		BlockingUtils.unblockPlayer(entity.discordUserId);
		if (reaction.first()) {
			if (reaction.first().emoji.name === MENU_REACTION.ACCEPT) {
				if (!canBuy(selectedClass.price, entity.Player)) {
					return sendErrorMessage(message.author, message.channel, language, format(
						JsonReader.commands.class.getTranslation(language).error.cannotBuy,
						{
							missingMoney: selectedClass.price - entity.Player.money
						}
					));
				}
				if (selectedClass.id === playerClass.id) {
					return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.class.getTranslation(language).error.sameClass);
				}
				await reaction.first().message.delete();
				entity.Player.class = selectedClass.id;
				const newClass = await Classes.getById(entity.Player.class);
				await entity.setHealth(Math.round(
					entity.health / playerClass.getMaxHealthValue(entity.Player.level) * newClass.getMaxHealthValue(entity.Player.level)
				), message.channel, language, false);
				await entity.Player.addMoney(entity, -selectedClass.price, message.channel, language);
				await MissionsController.update(entity.discordUserId, message.channel, language, "chooseClass");
				await MissionsController.update(entity.discordUserId, message.channel, language, "chooseClassTier", 1, { tier: selectedClass.classgroup });
				await Promise.all([
					entity.save(),
					entity.Player.save()
				]);
				log(entity.discordUserId + " bought the class " + newClass.en);
				return message.channel.send({ embeds: [
					new DraftBotEmbed()
						.formatAuthor(JsonReader.commands.class.getTranslation(language).success, message.author)
						.setDescription(JsonReader.commands.class.getTranslation(language).newClass + selectedClass.getName(language))
				] });
			}
		}
		sendErrorMessage(message.author, message.channel, language, JsonReader.commands.class.getTranslation(language).error.canceledPurchase);
	});

	await Promise.all([
		confirmMessage.react(MENU_REACTION.ACCEPT),
		confirmMessage.react(MENU_REACTION.DENY)
	]);
}

/**
 * @param {number} price - The item price
 * @param {Players} player
 */
const canBuy = function(price, player) {
	return player.money >= price;
};

module.exports.execute = ClassCommand;