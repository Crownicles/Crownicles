/**
 * Main function of small event
 * @param {module:"discord.js".Message} message
 * @param {"fr"|"en"} language
 * @param {Entities} entity
 * @param {module:"discord.js".MessageEmbed} seEmbed - The template embed to send.
 *    The description already contains the emote so you have to get it and add your text
 * @returns {Promise<>}
 */
const executeSmallEvent = async function(message, language, entity, seEmbed) {
	const randomItem = await entity.Player.Inventory.generateRandomItem(RARITY.SPECIAL);
	let price = getItemValue(randomItem);
	price = Math.round(randInt(1, 10) === 10 ? price * 5 : price *= 0.6);
	const gender = randInt(0, 1);
	const translationShop = JsonReader.smallEvents.shop.getTranslation(language);
	seEmbed.setDescription(seEmbed.description
		+ format(
			translationShop.intro[gender][randInt(0, translationShop.intro[gender].length)]
		+ translationShop.end, {
				name: translationShop.names[gender][
					randInt(0, translationShop.names[gender].length)
				],
				item: randomItem.toString(language),
				price: price
			}));
	const msg = await message.channel.send(seEmbed);
	await Promise.all([
		msg.react(MENU_REACTION.ACCEPT),
		msg.react(MENU_REACTION.DENY)
	]);
	const filterConfirm = (reaction, user) =>	(reaction.emoji.name === MENU_REACTION.ACCEPT ||
				reaction.emoji.name === MENU_REACTION.DENY) && user.id === entity.discordUserId;

	const collector = msg.createReactionCollector(filterConfirm, {time: COLLECTOR_TIME, max: 1});

	collector.on("end", async (reaction) => {
		removeBlockedPlayer(entity.discordUserId);
		if (reaction.first()) {
			if (reaction.first().emoji.name === MENU_REACTION.ACCEPT) {
				if (entity.Player.money < price) {
					return await sendErrorMessage(message.author, message.channel, language,
						format(JsonReader.commands.shop.getTranslation(language).error.cannotBuy,
							{missingMoney: price - entity.Player.money})
					);
				}
				await giveItem(entity, randomItem, language,
					message.author, message.channel, SMALL_EVENT.SHOP_RESALE_MULTIPLIER, 1);
				log(entity.discordUserId + " bought an item in a mini shop for " + price);
				entity.Player.addMoney(-price);
				await Promise.all([entity.Player.save(), entity.Player.Inventory.save()]);
				return;
			}
		}
		await sendErrorMessage(message.author, message.channel, language,
			JsonReader.commands.shop.getTranslation(language).error
				.canceledPurchase, true
		);
	});
};

module.exports = {
	executeSmallEvent: executeSmallEvent
};