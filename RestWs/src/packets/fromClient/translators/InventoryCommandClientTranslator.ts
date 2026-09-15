import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandInventoryPacketReq } from "../../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { InventoryReq } from "../../../../../WsPackets/src/fromClient/InventoryReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";

export default class InventoryCommandClientTranslator {
	@fromClientTranslator(InventoryReq)
	public static translate(context: PacketContext, packet: InventoryReq): Promise<CommandInventoryPacketReq> {
		return asyncMakePacket(CommandInventoryPacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}
}
