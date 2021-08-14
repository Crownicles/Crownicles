module.exports.commandInfo = {
	name: "give",
	aliases: [],
	userPermissions: ROLES.USER.BOT_OWNER
};

/**
 * Allow the bot owner to give an item to somebody
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {String[]} args=[] - Additional arguments sent with the command
 */
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";

const GiveCommand = async (message, language, args) => {
	const player = getUserFromMention(args[0]);
	const [entity] = await Entities.getOrRegister(player.id);
	const itemType = args[1];
	const itemId = args[2];
	await entity.Player.Inventory.giveObject(itemId, itemType);
	await entity.Player.Inventory.save();

	return await message.channel.send(new DraftBotEmbed()
		.formatAuthor(JsonReader.commands.giveCommand.getTranslation(language).giveSuccess, message.author)
		.setDescription(format(JsonReader.commands.giveCommand.getTranslation(language).descGive, {
			type: itemType,
			id: itemId,
			player: player
		})));
};

function getUserFromMention(mention) {
	if (!mention) {
		return;
	}

	if (mention.startsWith("<@") && mention.endsWith(">")) {
		mention = mention.slice(2, -1);

		if (mention.startsWith("!")) {
			mention = mention.slice(1);
		}

		return client.users.cache.get(mention);
	}
}

module.exports.execute = GiveCommand;