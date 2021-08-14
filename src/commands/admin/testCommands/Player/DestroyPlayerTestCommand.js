module.exports.commandInfo = {
	name: "destroyplayer",
	aliases: ["destroy"],
	commandFormat: "",
	messageWhenExecuted: "Vous avez été réinitialisé !",
	description: "Réinitialise votre joueur"
};

/**
 * Reset the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param {module:"discord.js".Message} message - Message from the discord server
 * @return {String} - The successful message formatted
 */
const destroyPlayerTestCommand = async (language, message) => {
	const [entity] = await Entities.getOrRegister(message.author.id);
	Inventories.destroy({
		where: {
			playerId: entity.Player.id
		}
	});
	Players.destroy({
		where: {
			entityId: entity.id
		}
	});
	Entities.destroy({
		where: {
			id: entity.id
		}
	});
	return module.exports.commandInfo.messageWhenExecuted;
};

module.exports.execute = destroyPlayerTestCommand;