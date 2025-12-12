import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { SmallEventDataController } from "../../../../data/SmallEvent";
import ReportCommand from "../../../player/ReportCommand";

const smallEventsKeys = SmallEventDataController.instance.getKeys();

const strings = ["Force le déclenchement d'un mini-événement spécifique pendant le voyage. Permet de tester tous les types de mini-événements disponibles :"];
smallEventsKeys
	.forEach(seName => {
		strings.push(`- ${seName}`);
	});

export const commandInfo: ITestCommand = {
	name: "smallEvent",
	aliases: ["se"],
	commandFormat: "<seName>",
	typeWaited: { seName: TypeKey.STRING },
	description: strings.join("\n"),
	argSuggestions: { seName: smallEventsKeys }
};

const smallEventsKeysLower = smallEventsKeys.map(seName => seName.toLowerCase());
const smallEventsKeysLowerToKeys = new Map<string, string>(smallEventsKeys.map(se => [se.toLowerCase(), se]));

/**
 * Force a small event with a given event name
 */
const smallEventTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const keyPos = smallEventsKeysLower.indexOf(args[0].toLowerCase());
	if (keyPos === -1) {
		throw new Error(`Erreur smallEvent : le mini-event ${args[0]} n'existe pas. Veuillez vous référer à la commande "test help smallEvent" pour plus d'informations`);
	}
	const realKey = smallEventsKeysLowerToKeys.get(args[0].toLowerCase());

	await ReportCommand.execute(response, player, {}, context, realKey);
	return `Mini event \`${realKey}\` forcé !`;
};

commandInfo.execute = smallEventTestCommand;
