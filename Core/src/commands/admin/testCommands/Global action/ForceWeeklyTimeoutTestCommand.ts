import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { CrowniclesMonday } from "../../../../core/bot/cronJobs/CrowniclesMonday";

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
	await CrowniclesMonday.job();
	return "Vous avez effectué une fin de semaine !";
};

commandInfo.execute = forceWeeklyTimeoutTestCommand;
