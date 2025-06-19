import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Maps } from "../../../../core/maps/Maps";
import { BigEventDataController } from "../../../../data/BigEvent";
import { Player } from "../../../../core/database/game/models/Player";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";

export const commandInfo: ITestCommand = {
	name: "listevents",
	aliases: ["listevent", "le"],
	description: "Liste tous les évènements disponibles pour chaque lieu"
};

/**
 * List all available events for each map
 */
const listEventsTestCommand: ExecuteTestCommandLike = async (player: Player) => {
	let str = "";

	// Let's display for every map all available events
	for (const map of Maps.getMaps()) {
		const events = await BigEventDataController.instance.getAvailableEvents(map.id, player);
		let eventsString = "";
		for (const event of events) {
			eventsString += `${event.id}\n`;
		}
		str += `${CrowniclesIcons.mapTypes[map.type]} **${map.id}**\n${eventsString}\n`;
	}
	return `${str}\n\nLa liste des évents pour chaque lieu a été envoyée !`;
};

commandInfo.execute = listEventsTestCommand;
