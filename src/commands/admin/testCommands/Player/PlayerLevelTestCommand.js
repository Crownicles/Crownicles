module.exports.commandInfo = {
	name: "playerlevel",
	aliases: ["level", "lvl"],
	commandFormat: "<niveau>",
	typeWaited: {
		niveau: typeVariable.INTEGER
	},
	messageWhenExecuted: "Vous êtes maintenant niveau {level} !",
	description: "Mets votre joueur au niveau donné"
};

/**
 * Set the level of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const playerLevelTestCommand = async (language, message, args) => {
	const [entity] = await Entities.getOrRegister(message.author.id);
	if (args[0] <= 0 || args[0] > 1000) {
		throw new Error("Erreur level : niveau donné doit être compris entre 1 et 1000 !");
	}
	entity.Player.level = parseInt(args[0],10);
	entity.Player.save();

	return format(module.exports.commandInfo.messageWhenExecuted, {level: entity.Player.level});
};

module.exports.execute = playerLevelTestCommand;