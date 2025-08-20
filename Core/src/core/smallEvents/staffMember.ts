import { SmallEventFuncs } from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventStaffMemberPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventStaffMemberPacket";
import { Maps } from "../maps/Maps";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: (response): void => {
		response.push(makePacket(SmallEventStaffMemberPacket, {}));
	}
};
