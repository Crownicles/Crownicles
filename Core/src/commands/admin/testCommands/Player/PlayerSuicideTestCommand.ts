import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";

export const commandInfo: ITestCommand = {
	name: "playerkill",
	aliases: ["kill", "suicide"],
	description: "Met instantanément la vie du joueur à 0 et le tue. Utile pour tester les mécaniques de mort, respawn et pénalités associées"
};

/**
 * Kill yourself
 */
const playerSuicideTestCommand: ExecuteTestCommandLike = async (player, _args, response) => {
	await player.addHealth(-player.health, response, NumberChangeReason.TEST, {
		overHealCountsForMission: true,
		shouldPokeMission: true
	});
	await player.killIfNeeded(response, NumberChangeReason.TEST);
	await Promise.all([player.save(), player.save()]);

	return "Vous vous êtes suicidé avec succès !";
};

commandInfo.execute = playerSuicideTestCommand;
