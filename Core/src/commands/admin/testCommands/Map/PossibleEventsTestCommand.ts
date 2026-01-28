import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { BigEventDataController } from "../../../../data/BigEvent";
import { verifyTrigger } from "../../../../data/events/BigEventTrigger";

export const commandInfo: ITestCommand = {
	name: "possibleEvents",
	description: "Affiche la liste des événements pouvant se déclencher sur la carte actuelle avec leurs conditions et leur statut de validation"
};

/**
 * Display all possible events
 */
const possibleEventsTestCommand: ExecuteTestCommandLike = async player => {
	const mapId = player.getDestinationId()!;

	const possibleEvents = BigEventDataController.instance.getEventsNotFiltered(mapId);
	let str = `Current datetime: ${Date.now()
		.toLocaleString()}\n`;
	for (const event of possibleEvents) {
		str += `Event n°**${event.id}**\nTriggers :\n`;
		for (const trigger of event.triggers) {
			str += `- ${JSON.stringify(trigger)} : **${await verifyTrigger(event, trigger, mapId!, player)}**\n`;
		}
		str += "\n";
	}

	return str;
};

commandInfo.execute = possibleEventsTestCommand;
