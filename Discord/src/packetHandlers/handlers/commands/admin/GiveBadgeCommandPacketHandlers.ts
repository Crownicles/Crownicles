import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGetPlayerInfoRes
} from "../../../../../../Lib/src/packets/commands/CommandGetPlayerInfo";
import {
	CommandGetResourcesRes
} from "../../../../../../Lib/src/packets/commands/CommandGetResourcesPacket";

export default class GiveBadgeCommandPacketHandlers {
	@packetHandler(CommandGetResourcesRes)
	async giveBadgeGetResourcesRes(_context: PacketContext, _packet: CommandGetResourcesRes): Promise<void> {
		/*
		 * This packet is normally consumed by GiveBadgeCommand's async callback.
		 * If a duplicate response slips through, ignore it instead of surfacing a false error.
		 */
	}

	@packetHandler(CommandGetPlayerInfoRes)
	async giveBadgeGetPlayerInfoRes(_context: PacketContext, _packet: CommandGetPlayerInfoRes): Promise<void> {
		/*
		 * This packet is normally consumed by GiveBadgeCommand's async callback.
		 * If a duplicate response slips through, ignore it instead of surfacing a false error.
		 */
	}
}
