import {
	CommandsTest, ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import ReportCommand from "../../../player/ReportCommand";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportPacketReq } from "../../../../../../Lib/src/packets/commands/CommandReportPacket";

export const commandInfo: ITestCommand = {
	name: "forcereport",
	aliases: ["fr", "forcer"],
	commandFormat: "<id>",
	typeWaited: { id: TypeKey.INTEGER },
	description: "Force un événement spécifique lors du prochain /report. Utile pour tester des événements précis. Utilisez -1 pour un événement aléatoire. Voir /test listevents pour les IDs",
	argSuggestions: { id: ["-1", "1", "2", "3", "4", "5", "10", "20", "50"] }
};

/**
 * Force a report with a given event id
 */
const forceReportTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	await CommandsTest.getTestCommand("atravel").execute(player, ["5000"], response, context);
	await ReportCommand.execute(response, player, makePacket(CommandReportPacketReq, {}), context, null, parseInt(args[0], 10));
	return `Event ${args[0] === "-1" ? "aléatoire" : args[0]} forcé !`;
};

commandInfo.execute = forceReportTestCommand;
