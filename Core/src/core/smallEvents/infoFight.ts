import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { SmallEventInfoFightPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventInfoFightPacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { MissionsController } from "../missions/MissionsController";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => Maps.isOnContinent(player),
	executeSmallEvent: async (response, player): Promise<void> => {
		// Determine if the player is left-handed or right-handed according to the same logic as for fightPet
		const isLeftHanded = player.id % 10 === SmallEventConstants.FIGHT_PET.LAST_DIGIT_LEFT_HANDED;

		// small chance of having the new message with handedness information
		const showHandednessInfo = RandomUtils.crowniclesRandom.bool(SmallEventConstants.INFO_FIGHT.HANDEDNESS_INFO_CHANCE);

		response.push(makePacket(SmallEventInfoFightPacket, {
			isLeftHanded,
			showHandednessInfo
		}));

		// Update the mission for meeting Sir Rowan
		await MissionsController.update(player, response, { missionId: "meetSirRowan" });
	}
};
