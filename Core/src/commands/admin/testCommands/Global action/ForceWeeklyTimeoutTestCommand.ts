import { Crownicles } from "../../../../core/bot/Crownicles";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "forceweeklytimeout",
	aliases: [
		"forceweektimeout",
		"weektlyimeout",
		"weektimeout"
	],
	description: "Effectue une fin de semaine (actions hebdomadaires)"
};

/**
 * Force a weekly timeout
 */
const forceWeeklyTimeoutTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.weeklyTimeout();
	return "Vous avez effectué une fin de semaine !";
};

commandInfo.execute = forceWeeklyTimeoutTestCommand;
