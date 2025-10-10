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
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";

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
			response.push(makePacket(SmallEventClassOriginalityPacket, {
				playerClassId: player.class,
				leastCommonClassId: RandomUtils.crowniclesRandom.pick(leastCommonClassId)
			}));
			return;
		}
		await player.addScore({
			amount: SmallEventConstants.CLASS_ORIGINALITY.POINTS_TO_REWARD,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		response.push(makePacket(SmallEventClassOriginalityPacket, {
			isSuccess: true,
			score: SmallEventConstants.CLASS_ORIGINALITY.POINTS_TO_REWARD,
			playerClassId: player.class,
			leastCommonClassId: RandomUtils.crowniclesRandom.pick(leastCommonClassId)
		}));
	}
};
