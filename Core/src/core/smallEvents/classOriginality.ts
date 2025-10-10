import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { ClassDataController } from "../../data/Class";
import {
	Player,
	Players
} from "../database/game/models/Player";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventClassOriginalityPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventClassOriginalityPacket";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";

export const smallEventFuncs: SmallEventFuncs = {
	async canBeExecuted(player: Player): Promise<boolean> {
		return Maps.isOnContinent(player)
				&& await PlayerSmallEvents.playerSmallEventCount(player.id, "classOriginality") <= 3;
	},
	executeSmallEvent: async (response, player, _context): Promise<void> => {
		const currentClassGroup = ClassDataController.instance.getById(player.class).classGroup;
		const leastCommonClassId = await Players.getLeastCommonClassIdForTier(currentClassGroup);
		if (!leastCommonClassId.includes(currentClassGroup)) {
			response.push(makePacket(SmallEventClassOriginalityPacket, {}));
			return;
		}
		response.push(makePacket(SmallEventClassOriginalityPacket, { isSuccess: true }));
	}
};
