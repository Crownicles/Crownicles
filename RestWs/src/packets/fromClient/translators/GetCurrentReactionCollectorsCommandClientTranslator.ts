import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGetCurrentReactionCollectorsReq } from "../../../../../WsPackets/src/fromClient/GetCurrentReactionCollectorsReq";
import { CommandGetCurrentReactionCollectorsPacket } from "../../../../../Lib/src/packets/commands/CommandGetCurrentReactionCollectorsPacket";

export default class GetCurrentReactionCollectorsCommandClientTranslator {
	@fromClientTranslator(CommandGetCurrentReactionCollectorsReq)
	public static translate(_context: PacketContext, _packet: CommandGetCurrentReactionCollectorsReq): Promise<CommandGetCurrentReactionCollectorsPacket> {
		return asyncMakePacket(CommandGetCurrentReactionCollectorsPacket, {});
	}
}
