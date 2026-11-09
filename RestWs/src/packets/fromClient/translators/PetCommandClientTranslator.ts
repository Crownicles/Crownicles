import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPetPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetPacket";
import { PetReq } from "../../../../../WsPackets/src/fromClient/PetReq";
import { resolveAskedPlayer } from "../AskedPlayerResolver";

export default class PetCommandClientTranslator {
	@fromClientTranslator(PetReq)
	public static translate(context: PacketContext, packet: PetReq): Promise<CommandPetPacketReq> {
		return asyncMakePacket(CommandPetPacketReq, { askedPlayer: resolveAskedPlayer(context, packet.askedPlayer) });
	}
}
