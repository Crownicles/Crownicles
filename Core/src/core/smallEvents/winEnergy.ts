import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { SmallEventWinEnergyPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => {
		const destinationId = player.getDestinationId();
		const originId = player.getPreviousMapId();
		return player.fightPointsLost > 0 && (destinationId === MapConstants.LOCATIONS_IDS.CLAIRE_DE_VILLE || originId === MapConstants.LOCATIONS_IDS.CLAIRE_DE_VILLE);
	},
	executeSmallEvent: async (response, player, _context, playerActiveObjects): Promise<void> => {
		player.setEnergyLost(0, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
		await player.save();
		response.push(makePacket(SmallEventWinEnergyPacket, {}));
	}
};
