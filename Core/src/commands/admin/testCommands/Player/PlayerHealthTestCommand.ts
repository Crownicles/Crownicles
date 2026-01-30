import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "playerhealth",
	aliases: ["health"],
	commandFormat: "<health>",
	typeWaited: { health: TypeKey.INTEGER },
	description: "Définit les points de vie actuels du joueur testeur. Ne peut pas dépasser les points de vie maximum. Utilisez 0 pour tuer le joueur"
};

/**
 * Set the health of the player
 */
const playerHealthTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const health = parseInt(args[0], 10);
	if (health < 0) {
		throw new Error("Erreur vie : vie donnée inférieure à 0 interdit !");
	}
	await player.addHealth({
		amount: parseInt(args[0], 10) - player.health,
		response,
		reason: NumberChangeReason.TEST,
		missionHealthParameter: {
			overHealCountsForMission: false,
			shouldPokeMission: false
		}
	});
	await player.save();

	return `Vous avez maintenant ${player.health} :heart:!`;
};

commandInfo.execute = playerHealthTestCommand;
