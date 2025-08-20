import { Crownicles } from "../../../../core/bot/Crownicles";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "forceseasonend",
	aliases: ["forcesea"],
	description: "Effectue une fin de saison (action hebdomadaire qui réinitialise le classement glorieux, et qui annonce le gagnant de la semaine)"
};

/**
 * Force a season end event
 */
const forceTopWeekEndTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.seasonEnd();
	return "Vous avez effectué une fin de saison !";
};

commandInfo.execute = forceTopWeekEndTestCommand;
