import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandSellPacketReq } from "../../../../../Lib/src/packets/commands/CommandSellPacket";
import { SellReq } from "../../../../../WsPackets/src/fromClient/SellReq";
import { fromClientTranslator } from "../FromClientTranslator";

export default class SellCommandClientTranslator {
	@fromClientTranslator(SellReq)
	public static open(_context: PacketContext, _packet: SellReq): Promise<CommandSellPacketReq> {
		return asyncMakePacket(CommandSellPacketReq, {});
	}
}
