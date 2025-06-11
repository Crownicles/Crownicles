import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { SmallEventInfoFightPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventInfoFightPacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => Maps.isOnContinent(player),
	executeSmallEvent: (response): void => {
		response.push(makePacket(SmallEventInfoFightPacket, {}));
	}
};
