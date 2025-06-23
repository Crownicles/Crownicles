import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { TravelTime } from "../maps/TravelTime";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventAdvanceTimePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventAdvanceTimePacket";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player): Promise<void> => {
		const timeAdvanced = RandomUtils.crowniclesRandom.integer(10, 50);
		await TravelTime.timeTravel(player, timeAdvanced, NumberChangeReason.SMALL_EVENT);
		await player.save();
		response.push(makePacket(SmallEventAdvanceTimePacket, { amount: timeAdvanced }));
	}
};
