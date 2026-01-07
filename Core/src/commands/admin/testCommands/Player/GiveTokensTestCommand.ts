import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "givetokens",
	aliases: [
		"tokens",
		"jetons",
		"gtk"
	],
	commandFormat: "<tokens>",
	typeWaited: { tokens: TypeKey.INTEGER },
	description: "Ajoute ou retire des jetons au joueur testeur. Peut être négatif pour retirer des jetons",
	argSuggestions: { tokens: ["1", "5", "10", "25", "50", "100", "-1", "-5"] }
};

/**
 * Give or remove tokens to/from the player
 */
const giveTokensTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	await player.addTokens({
		amount: parseInt(args[0], 10),
		response,
		reason: NumberChangeReason.TEST
	});
	await player.save();

	return `Vous avez maintenant ${player.tokens} jetons !`;
};

commandInfo.execute = giveTokensTestCommand;
