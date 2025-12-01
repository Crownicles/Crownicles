import { SmallEventFuncs } from "../../data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventWinHealthPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinHealthPacket";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: (player, playerActiveObjects) => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		return player.getHealth(playerActiveObjects) < player.getMaxHealth(playerActiveObjects);
	},
	executeSmallEvent: async (response, player, _context, playerActiveObjects): Promise<void> => {
		const healthWon = RandomUtils.rangedInt(SmallEventConstants.HEALTH);
		await player.addHealth(healthWon, response, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
		await player.save();
		response.push(makePacket(SmallEventWinHealthPacket, { amount: healthWon }));
	}
};
