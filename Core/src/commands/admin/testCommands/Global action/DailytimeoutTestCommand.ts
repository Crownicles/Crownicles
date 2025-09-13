import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Crownicles } from "../../../../core/bot/Crownicles";

export const commandInfo: ITestCommand = {
	name: "dailytimeout",
	description: "Déclenche manuellement les actions quotidiennes du serveur : actualise la potion du jour, retire des points d'amour des pets, etc. ATTENTION : affecte tous les joueurs"
};

/**
 * Do a dailytimeout
 */
const dailyTimeoutTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.dailyTimeout();
	return "Vous avez effectué un dailytimeout !";
};

commandInfo.execute = dailyTimeoutTestCommand;
