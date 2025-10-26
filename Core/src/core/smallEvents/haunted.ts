import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { Maps } from "../maps/Maps";
import { SmallEventHauntedPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventHauntedPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnHauntedPath,
	executeSmallEvent: (response): void => {
		response.push(makePacket(SmallEventHauntedPacket, {}));
	}
};
