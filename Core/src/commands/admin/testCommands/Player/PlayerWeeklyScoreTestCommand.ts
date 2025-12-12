import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playerweeklyscore",
	aliases: ["weeklyscore"],
	commandFormat: "<weeklyscore>",
	typeWaited: {
		weeklyscore: TypeKey.INTEGER
	},
	description: "Définit le score hebdomadaire du joueur testeur. (le nombre de points gagnés depuis le début de la semaine) indépendant du score du joueur /!",
	argSuggestions: { weeklyscore: ["0", "100", "500", "1000", "5000", "10000"] }
};


/**
 * Set the weeklyscore of the player
 */
const playerWeeklyScoreTestCommand: ExecuteTestCommandLike = async (player, args) => {
	player.weeklyScore = parseInt(args[0], 10);
	await player.save();

	return `Vous avez maintenant ${player.weeklyScore} points de la semaine !`;
};

commandInfo.execute = playerWeeklyScoreTestCommand;
