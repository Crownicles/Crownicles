import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { CrowniclesSunday } from "../../../../core/bot/cronJobs/CrowniclesSunday";

export const commandInfo: ITestCommand = {
	name: "forceseasonend",
	aliases: ["forcesea"],
	description: "Force la fin de saison complète : réinitialise le classement glorieux, annonce le gagnant, distribue les récompenses et archive les résultats. ATTENTION : affecte tous les joueurs"
};

/**
 * Force a season end event
 */
const forceTopWeekEndTestCommand: ExecuteTestCommandLike = async () => {
	await CrowniclesSunday.job();
	return "Vous avez effectué une fin de saison !";
};

commandInfo.execute = forceTopWeekEndTestCommand;
