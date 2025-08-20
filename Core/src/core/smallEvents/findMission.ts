import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import { MissionSlots } from "../database/game/models/MissionSlot";
import { MissionsController } from "../missions/MissionsController";
import { SmallEventFindMissionPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFindMissionPacket";

export const smallEventFuncs: SmallEventFuncs = {
	/**
	 * You must have an empty mission slot to have this small event
	 * @param player
	 *
	 */
	canBeExecuted: async (player: Player): Promise<boolean> => Maps.isOnContinent(player) && player.hasEmptyMissionSlot(await MissionSlots.getOfPlayer(player.id)),


	/**
	 * Find a new mission
	 * @param response
	 * @param player
	 */
	executeSmallEvent: async (response: CrowniclesPacket[], player: Player): Promise<void> => {
		const missionSlot = await MissionsController.addRandomMissionToPlayer(player, MissionsController.getRandomDifficulty(player));
		response.push(makePacket(SmallEventFindMissionPacket, {
			mission: MissionsController.prepareMissionSlot(missionSlot)
		}));
	}
};
