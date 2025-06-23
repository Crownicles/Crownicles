import { ChangeBlockingReasonPacket } from "../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import { ReactionCollectorResetTimerPacketReq } from "../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { CommandPingPacketReq } from "../../../Lib/src/packets/commands/CommandPingPacket";
import { ReactionCollectorReactPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";

export abstract class CoreConstants {
	static BYPASS_MAINTENANCE_AND_RESETS_PACKETS = [
		ReactionCollectorReactPacket.name,
		ChangeBlockingReasonPacket.name,
		ReactionCollectorResetTimerPacketReq.name,
		CommandPingPacketReq.name
	];

	static OPENING_LINE = "Crownicles Core";
}
