import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { MissionSlots } from "../../../../core/database/game/models/MissionSlot";

export const commandInfo: ITestCommand = {
	name: "expireMissions",
	description: "Force l'expiration immédiate de toutes les missions non-campagne du joueur. Utile pour tester les mécaniques de renouvellement des missions"
};

/**
 * Print missions info
 */
const expireMissionsTestCommand: ExecuteTestCommandLike = async player => {
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	for (const mission of missionSlots) {
		if (!mission.isCampaign()) {
			mission.expiresAt = new Date(1);
			await mission.save();
		}
	}
	return "Toutes les missions ont expiré";
};

commandInfo.execute = expireMissionsTestCommand;
