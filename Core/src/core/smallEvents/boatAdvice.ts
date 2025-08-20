import { SmallEventFuncs } from "../../data/SmallEvent";
import { SmallEventBoatAdvicePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBoatAdvicePacket";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnBoat,
	executeSmallEvent: (response): void => {
		response.push(makePacket(SmallEventBoatAdvicePacket, {}));
	}
};
