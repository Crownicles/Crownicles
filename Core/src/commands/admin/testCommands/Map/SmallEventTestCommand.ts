import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { SmallEventDataController } from "../../../../data/SmallEvent";
import ReportCommand from "../../../player/ReportCommand";

export const commandInfo: ITestCommand = {
	name: "smallEvent",
	aliases: ["se"],
	commandFormat: "<seName>",
	typeWaited: { seName: TypeKey.STRING },

	// The small events are imported after the test commands, when the bot starts
	get description(): string {
		return [
			"Force le déclenchement d'un mini-événement spécifique pendant le voyage. Permet de tester tous les types de mini-événements disponibles :",
			...SmallEventDataController.instance.getKeys()
				.map(seName => `- ${seName}`)
		].join("\n");
	}
};

/**
 * Force a small event with a given event name
 */
const smallEventTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const realKey = SmallEventDataController.instance.getKeys()
		.find(seName => seName.toLowerCase() === args[0].toLowerCase());
	if (!realKey) {
		throw new Error(`Erreur smallEvent : le mini-event ${args[0]} n'existe pas. Veuillez vous référer à la commande "test help smallEvent" pour plus d'informations`);
	}

	await ReportCommand.execute(response, player, {}, context, realKey);
	return `Mini event \`${realKey}\` forcé !`;
};

commandInfo.execute = smallEventTestCommand;
