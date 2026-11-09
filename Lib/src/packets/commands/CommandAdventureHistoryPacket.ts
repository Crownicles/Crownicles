import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { AdventureHistoryEvent } from "../../types/AdventureHistory";
import { Second } from "../../types/TimeTypes";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandAdventureHistoryReq extends CrowniclesPacket {
	page?: number;

	until?: Second;
}

@sendablePacket(PacketDirection.NONE)
export class CommandAdventureHistoryRes extends CrowniclesPacket {
	available = true;

	entries!: AdventureHistoryEvent[];

	until!: Second;

	windowStartsAt!: Second;

	nextPage?: number;
}
