import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { MissionSlots } from "../../../../core/database/game/models/MissionSlot";
import { MissionDataController } from "../../../../data/Mission";

export const commandInfo: ITestCommand = {
	name: "debugMissions",
	aliases: ["debugm", "debm"],
	description: "Affiche un rapport détaillé des missions du joueur : slots actifs, gemmes, progression de campagne et informations de debug"
};

/**
 * Print missions info
 */
const debugMissionsTestCommand: ExecuteTestCommandLike = async player => {
	const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	return `Debug missions
⚙️ General
Daily mission done: ${missionsInfo.dailyMissionNumberDone}
Last daily mission done: ${missionsInfo.lastDailyMissionCompleted.toString()}
Gems count: ${missionsInfo.gems}
Campaign progression: ${missionsInfo.campaignProgression}
Campaign blob: ${missionsInfo.campaignBlob}

📜 Missions
${missionSlots.map(missionSlot => {
	const mission = MissionDataController.instance.getById(missionSlot.missionId);
	return `${mission?.id ?? "unknown"} (id: ${missionSlot.missionId}
				)
-> ID DB: ${missionSlot.id}

-> Variant: ${missionSlot.missionVariant}

-> Number done: ${missionSlot.numberDone}

-> Objective: ${missionSlot.missionObjective}

-> Expiration date: ${missionSlot.expiresAt ? new Date(missionSlot.expiresAt).toISOString() : "Never"}

-> Campaign only: ${mission?.campaignOnly ?? "unknown"}

-> Save blob: ${missionSlot.saveBlob}

`;
}).join("\n")}`;
};

commandInfo.execute = debugMissionsTestCommand;
