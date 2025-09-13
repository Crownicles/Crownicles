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
	description: "Déclenche manuellement les actions hebdomadaires du serveur : calculs des classements, récompenses de fin de semaine, renouvellement des contenus. ATTENTION : affecte tous les joueurs"
};

/**
 * Force a weekly timeout
 */
const forceWeeklyTimeoutTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.weeklyTimeout();
	return "Vous avez effectué une fin de semaine !";
};

commandInfo.execute = forceWeeklyTimeoutTestCommand;
