import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandInventoryPacketReq } from "../../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { InventoryReq } from "../../../../../WsPackets/src/fromClient/InventoryReq";

export default class InventoryCommandClientTranslator {
	@fromClientTranslator(InventoryReq)
	public static translate(_context: PacketContext, packet: InventoryReq): Promise<CommandInventoryPacketReq> {
		return asyncMakePacket(CommandInventoryPacketReq, {
			askedPlayer: {
				rank: packet.askedPlayer.keycloakId ? undefined : packet.askedPlayer.rank ?? undefined,
				keycloakId: packet.askedPlayer.keycloakId ?? undefined
			}
		});
	}
}
