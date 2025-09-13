import { Crownicles } from "../../../../core/bot/Crownicles";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "forceseasonend",
	aliases: ["forcesea"],
	description: "Force la fin de saison complète : réinitialise le classement glorieux, annonce le gagnant, distribue les récompenses et archive les résultats. ATTENTION : affecte tous les joueurs"
};

/**
 * Force a season end event
 */
const forceTopWeekEndTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.seasonEnd();
	return "Vous avez effectué une fin de saison !";
};

commandInfo.execute = forceTopWeekEndTestCommand;
