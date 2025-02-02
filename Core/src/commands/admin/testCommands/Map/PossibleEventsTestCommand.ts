import {ExecuteTestCommandLike, ITestCommand} from "../../../../core/CommandsTest";
import {BigEventDataController} from "../../../../data/BigEvent";
import {verifyTrigger} from "../../../../data/events/BigEventTrigger";

export const commandInfo: ITestCommand = {
	name: "possibleEvents",
	description: "Affiche les évents possibles"
};

/**
 * Display all possible events
 */
const possibleEventsTestCommand: ExecuteTestCommandLike = async (player) => {
	const mapId = player.getDestinationId();

	const possibleEvents = BigEventDataController.instance.getEventsNotFiltered(mapId);
	let str = "";
	for (const event of possibleEvents) {
		str += `Event n°**${event.id}**\nTriggers :\n`;
		for (const trigger of event.triggers) {
			str += `- ${JSON.stringify(trigger)} : **${await verifyTrigger(event, trigger, mapId, player)}**\n`;
		}
		str += "\n";
	}

	return str;
};

commandInfo.execute = possibleEventsTestCommand;