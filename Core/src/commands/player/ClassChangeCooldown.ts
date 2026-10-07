import Player from "../../core/database/game/models/Player";
import { MissionSlots } from "../../core/database/game/models/MissionSlot";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { ClassDataController } from "../../data/Class";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { secondsToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

export const CLASS_CHOICE_MISSION = "chooseClass" as const;

/** A pending first-choice mission is not a respecialization, even for a profile reset with old logs. */
export async function classChangeCooldownUntil(player: Player): Promise<number | null> {
	if (player.class === ClassConstants.CLASSES_ID.RECRUIT) {
		const campaign = await MissionSlots.getCampaignOfPlayer(player.id);
		if (campaign?.missionId === CLASS_CHOICE_MISSION && !campaign.isCompleted()) {
			return null;
		}
	}
	const currentClassGroup = ClassDataController.instance.getById(player.class)!.classGroup;
	const lastChange = await LogsReadRequests.getLastTimeThePlayerHasEditedHisClass(player.keycloakId);
	const availableAt = lastChange.valueOf() + secondsToMilliseconds(ClassConstants.TIME_BEFORE_CHANGE_CLASS[currentClassGroup]);
	return availableAt > Date.now() ? availableAt : null;
}
