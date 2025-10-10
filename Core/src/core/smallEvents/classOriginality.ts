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
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

export const smallEventFuncs: SmallEventFuncs = {
	async canBeExecuted(player: Player): Promise<boolean> {
		return Maps.isOnContinent(player)
				&& await PlayerSmallEvents.playerSmallEventCount(player.id, "classOriginality") <= 3;
	},
	executeSmallEvent: async (response, player, _context): Promise<void> => {
		const currentClassGroup = ClassDataController.instance.getById(player.class).classGroup;
		const leastCommonClassId = await Players.getLeastCommonClassIdForTier(currentClassGroup);
		console.log(leastCommonClassId);
		if (!leastCommonClassId.includes(player.class)) {
			response.push(makePacket(SmallEventClassOriginalityPacket, {}));
			return;
		}
		await player.addScore({
			amount: 1000,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		response.push(makePacket(SmallEventClassOriginalityPacket, {
			isSuccess: true, score: 1000
		}));
	}
};
