import Player from "../database/game/models/Player";
import { MissionSlots } from "../database/game/models/MissionSlot";

/**
 * Reset expedition streak mission progress if the latest expedition failed.
 * Resets ALL incomplete expeditionStreak missions (campaign + side quests).
 */
export async function resetExpeditionStreakMission(player: Player): Promise<void> {
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	const streakMissions = missionSlots.filter(slot => slot.missionId === "expeditionStreak" && !slot.isCompleted());

	for (const mission of streakMissions) {
		mission.numberDone = 0;
		await mission.save();
	}
}
