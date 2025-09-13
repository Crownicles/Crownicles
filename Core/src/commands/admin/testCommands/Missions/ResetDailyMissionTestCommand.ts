import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";

export const commandInfo: ITestCommand = {
	name: "resetDailyMission",
	aliases: ["rdm"],
	description: "Remet à zéro le compteur de missions quotidiennes du joueur testeur, permettant de refaire la mission quotidienne actuelle"
};

/**
 * Set the weapon of the player
 */
const resetDailyMissionTextCommand: ExecuteTestCommandLike = async player => {
	const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	missionsInfo.dailyMissionNumberDone = 0;
	missionsInfo.lastDailyMissionCompleted = new Date(0);
	await missionsInfo.save();
	return "Votre mission quotidienne a été réinitiliasée !";
};

commandInfo.execute = resetDailyMissionTextCommand;
