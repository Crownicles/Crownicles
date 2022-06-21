import {Entities} from "../../../../core/models/Entity";

module.exports.commandInfo = {
	name: "attack",
	commandFormat: "<attack>",
	typeWaited: {
		attack: typeVariable.INTEGER
	},
	messageWhenExecuted: "Vous avez maintenant {attack} :crossed_swords:!",
	description: "Mets l'attaque de votre joueur à la valeur donnée",
	commandTestShouldReply: true
};

/**
 * Set the attack of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const attackTestCommand = async (language, interaction, args) => {
	const [entity] = await Entities.getOrRegister(interaction.user.id);
	if (args[0] < 0) {
		throw new Error("Erreur attack : attack donné inférieur à 0 interdit !");
	}
	entity.attack = parseInt(args[0], 10);
	await entity.save();

	return format(module.exports.commandInfo.messageWhenExecuted, {attack: entity.attack});
};

module.exports.execute = attackTestCommand;