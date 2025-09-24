import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { SmallEventWinEnergyOnIslandPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyOnIslandPacket";
import { Maps } from "../maps/Maps";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => Maps.isOnPveIsland(player) && player.fightPointsLost > 0,
	executeSmallEvent: async (response, player, _context, playerActiveObjects): Promise<void> => {
		const maxCumulativeEnergy = player.getMaxCumulativeEnergy(playerActiveObjects);
		const amount = RandomUtils.randInt(
			Math.max(PVEConstants.FIGHT_POINTS_SMALL_EVENT.MIN_PERCENT * maxCumulativeEnergy, 1),
			PVEConstants.FIGHT_POINTS_SMALL_EVENT.MAX_PERCENT * maxCumulativeEnergy
		);
		player.addEnergy(amount, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
		await player.save();
		response.push(makePacket(SmallEventWinEnergyOnIslandPacket, { amount }));
	}
};
