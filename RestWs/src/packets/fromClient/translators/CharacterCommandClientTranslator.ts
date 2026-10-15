import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandRarityPacketReq } from "../../../../../Lib/src/packets/commands/CommandRarityPacket";
import { CommandBlessingPacketReq } from "../../../../../Lib/src/packets/commands/CommandBlessingPacket";
import { RarityReq } from "../../../../../WsPackets/src/fromClient/RarityReq";
import { BlessingReq } from "../../../../../WsPackets/src/fromClient/BlessingReq";

export default class CharacterCommandClientTranslator {
	@fromClientTranslator(RarityReq)
	public static rarity(_context: PacketContext, _packet: RarityReq): Promise<CommandRarityPacketReq> {
		return asyncMakePacket(CommandRarityPacketReq, {});
	}

	@fromClientTranslator(BlessingReq)
	public static blessing(_context: PacketContext, _packet: BlessingReq): Promise<CommandBlessingPacketReq> {
		return asyncMakePacket(CommandBlessingPacketReq, {});
	}
}
