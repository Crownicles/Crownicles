import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playerhealth",
	aliases: ["health"],
	commandFormat: "<health>",
	typeWaited: {
		health: TypeKey.INTEGER
	},
	description: "Mets la vie de votre joueur à la valeur donnée"
};

/**
 * Set the health of the player
 */
const playerHealthTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const health = parseInt(args[0], 10);
	if (health < 0) {
		throw new Error("Erreur vie : vie donnée inférieure à 0 interdit !");
	}
	await player.addHealth(parseInt(args[0], 10) - player.health, response, NumberChangeReason.TEST, {
		overHealCountsForMission: false,
		shouldPokeMission: false
	});
	await player.save();

	return `Vous avez maintenant ${player.health} :heart:!`;
};

commandInfo.execute = playerHealthTestCommand;
