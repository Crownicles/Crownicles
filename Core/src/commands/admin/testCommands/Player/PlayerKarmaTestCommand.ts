import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playerkarma",
	aliases: ["karma"],
	description: "Affiche votre karma actuel"
};

/**
 * Display the player's current karma
 */
const playerKarmaTestCommand: ExecuteTestCommandLike = (player, _args, _response) => {
	return `Votre karma actuel est de : ${player.karma} 🎭`;
};

commandInfo.execute = playerKarmaTestCommand;
