import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { Crownicles } from "../../../../core/bot/Crownicles";

export const commandInfo: ITestCommand = {
	name: "dailytimeout",
	description: "Effectue un dailytimeout (action journalière qui actualise la potion du jour et retire des lovePoints des pets)"
};

/**
 * Do a dailytimeout
 */
const dailyTimeoutTestCommand: ExecuteTestCommandLike = async () => {
	await Crownicles.dailyTimeout();
	return "Vous avez effectué un dailytimeout !";
};

commandInfo.execute = dailyTimeoutTestCommand;
