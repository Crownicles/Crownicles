import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";

export const commandInfo: ITestCommand = {
	name: "glorypoints",
	aliases: ["glory"],
	commandFormat: "<points> <type>",
	typeWaited: {
		"points": TypeKey.INTEGER,
		"type (0 = defensif 1 = attack)": TypeKey.INTEGER
	},
	description: "Permet de définir les points de gloire d'attaque ou de défense d'un joueur pour tester les mécaniques PvP. Type : 0 = défensif, 1 = attaque",
	argSuggestions: {
		"points": ["100", "500", "1000", "2000", "5000"],
		"type (0 = defensif 1 = attack)": ["0", "1"]
	},
	fullSuggestions: [
		"100 0", "100 1",
		"500 0", "500 1",
		"1000 0", "1000 1",
		"2000 0", "2000 1",
		"5000 0", "5000 1"
	]
};

/**
 * Set the glory points of the player
 */
const gloryPointsTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const gloryPoints = parseInt(args[0], 10);
	const type = parseInt(args[1], 10);

	if (gloryPoints < 0) {
		throw new Error("Erreur glory points : glory points inférieurs à 0 interdits !");
	}
	await player.setGloryPoints(gloryPoints, type === 0, NumberChangeReason.TEST, response);
	await player.save();

	return `Vous avez maintenant ${player.getGloryPoints()} :sparkles: !`;
};

commandInfo.execute = gloryPointsTestCommand;
