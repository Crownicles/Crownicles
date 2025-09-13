import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "fightpointslost",
	aliases: ["fpl"],
	commandFormat: "<lostPoints>",
	typeWaited: {
		lostPoints: TypeKey.INTEGER
	},
	description: "Permet de configurer le nombre de point d'énergie manquant au joueur. ex si un valeur a 100 d'énergie au max et execute cette commande avec la valeur 10 il aura 90/100 énergie"
};

/**
 * Set fightpointslost of the player
 */
const energyLostTestCommand: ExecuteTestCommandLike = async (player, args) => {
	player.fightPointsLost = parseInt(args[0], 10);
	await player.save();

	return `Vous avez maintenant ${args[0]} fightpointslost !`;
};

commandInfo.execute = energyLostTestCommand;
