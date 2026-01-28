import { Maps } from "../../../../core/maps/Maps";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "mapinfo",
	description: "Affiche des informations de debug sur la position actuelle : cartes précédente et actuelle, statut de voyage, IDs et noms des lieux"
};

/**
 * Give you information about the map you are on
 */
const mapInfoTestCommand: ExecuteTestCommandLike = async player => {
	const currMap = player.getDestination();
	const prevMap = player.getPreviousMap();
	const travelling = Maps.isTravelling(player);

	if (!currMap) {
		return "🗺️ Map debugging : No current map found";
	}

	return `🗺️ Map debugging :
Previous map : ${prevMap ? `${prevMap.id} (id: ${prevMap.id})` : "None"}
${travelling ? "Next map" : "Current map"} : ${currMap.id} (id: ${currMap.id})
${travelling
	? ""
	: `Next available maps : ${
		Maps.getNextPlayerAvailableMaps(player)
			.map(map => `${map} (id: ${map})`)
			.join("\n")
	}`}
Players : :speech_balloon: ${await currMap.playersCount(prevMap?.id ?? 0)} player(s) on this map`;
};

commandInfo.execute = mapInfoTestCommand;
