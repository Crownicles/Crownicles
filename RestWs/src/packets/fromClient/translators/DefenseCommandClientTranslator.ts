import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandDefensePacketReq } from "../../../../../Lib/src/packets/commands/CommandDefensePacket";
import { DefenseReq } from "../../../../../WsPackets/src/fromClient/DefenseReq";

export default class DefenseCommandClientTranslator {
	@fromClientTranslator(DefenseReq)
	public static open(_context: PacketContext, _packet: DefenseReq): Promise<CommandDefensePacketReq> {
		return asyncMakePacket(CommandDefensePacketReq, {});
	}
}
