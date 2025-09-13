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
	description: "Définit le score hebdomadaire du joueur testeur. Le score hebdomadaire détermine le classement glorieux et se remet à zéro chaque semaine"
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
