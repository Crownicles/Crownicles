import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { TravelTime } from "../../../../core/maps/TravelTime";
import { Players } from "../../../../core/database/game/models/Player";
import { Effect } from "../../../../../../Lib/src/types/Effect";

export const commandInfo: ITestCommand = {
	name: "jailplayer",
	aliases: ["jail"],
	commandFormat: "<id>",
	typeWaited: { id: TypeKey.ID },
	description: "Applique l'effet 'emprisonné' au joueur spécifié par son ID. Bloque le joueur et l'empêche d'effectuer des actions"
};

/**
 * Jail the given player
 */
const jailPlayerTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const jailPlayer = await Players.getByKeycloakId(player.keycloakId);
	if (jailPlayer.effectId === Effect.NOT_STARTED.id) {
		// Prevent the non initialized player to mess with the game's travel logic
		throw new Error("Ce joueur n'a pas encore démarré l'aventure, laissez lui le temps de commencer !");
	}
	await TravelTime.applyEffect(jailPlayer, Effect.JAILED, 0, new Date(), NumberChangeReason.TEST);
	await jailPlayer.save();
	return `Vous avez enfermé ${args[0]} !`;
};

commandInfo.execute = jailPlayerTestCommand;
