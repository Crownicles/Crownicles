import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playerscore",
	aliases: ["score"],
	commandFormat: "<score>",
	typeWaited: { score: TypeKey.INTEGER },
	description: "Définit le score total du joueur testeur."
};

/**
 * Set the score of the player
 */
const playerScoreTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const score = parseInt(args[0], 10);
	if (score < 100) {
		throw new Error("Erreur score : score donné inférieur à 100 interdit !");
	}
	await player.addScore({
		amount: score - player.score,
		response,
		reason: NumberChangeReason.TEST
	});
	await player.save();

	return `Vous avez maintenant ${player.score} :medal: !`;
};

commandInfo.execute = playerScoreTestCommand;
