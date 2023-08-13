import {NumberChangeReason} from "../../../../core/constants/LogsConstants";
import {format} from "../../../../core/utils/StringFormatter";
import {CommandInteraction} from "discord.js";
import {Constants} from "../../../../core/Constants";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";

export const commandInfo: ITestCommand = {
	name: "playerscore",
	aliases: ["score"],
	commandFormat: "<score>",
	typeWaited: {
		score: Constants.TEST_VAR_TYPES.INTEGER
	},
	messageWhenExecuted: "Vous avez maintenant {score} :medal: !",
	description: "Mets le score de votre joueur à la valeur donnée",
	commandTestShouldReply: true,
	execute: null // Defined later
};

/**
 * Set the score of the player
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param {String[]} args=[] - Additional arguments sent with the command
 * @return {String} - The successful message formatted
 */
const playerScoreTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);
	const score = parseInt(args[0], 10);
	if (score < 100) {
		throw new Error("Erreur score : score donné inférieur à 100 interdit !");
	}
	await player.addScore({
		amount: score - player.score,
		channel: interaction.channel,
		language,
		reason: NumberChangeReason.TEST
	});
	await player.save();

	return format(commandInfo.messageWhenExecuted, {score: player.score});
};

commandInfo.execute = playerScoreTestCommand;