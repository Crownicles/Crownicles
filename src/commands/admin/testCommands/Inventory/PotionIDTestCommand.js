module.exports.commandInfo = {
	name: "potionid",
	commandFormat: "<id>",
	typeWaited: {
		id: typeVariable.INTEGER
	},
	messageWhenExecuted: "Vous avez maintenant la potion {potion} !",
	description: "Change la potion de votre joueur"
};

/**
 * Set the potion of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const potionIDTestCommand = async (language, message, args) => {
	const [entity] = await Entities.getOrRegister(message.author.id);

	entity.Player.Inventory.potionId = parseInt(args[0],10);
	let potionText;
	try {
		potionText = await (await entity.Player.Inventory.getPotion()).toFieldObject(language).value;
	}
	catch (e) {
		throw new Error("Potion avec id inexistant : " + args[0] + ". L'id de la potion doit être compris entre 0 et " + await Potions.getMaxId());
	}
	entity.Player.Inventory.save();

	return format(module.exports.commandInfo.messageWhenExecuted, {potion: potionText});
};

module.exports.execute = potionIDTestCommand;