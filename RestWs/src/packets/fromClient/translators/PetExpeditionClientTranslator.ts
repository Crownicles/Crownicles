import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetExpeditionPacketReq, CommandPetExpeditionResolvePacketReq
} from "../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	PetExpeditionReq, PetExpeditionResolveReq
} from "../../../../../WsPackets/src/fromClient/PetExpeditionReq";

export default class PetExpeditionClientTranslator {
	@fromClientTranslator(PetExpeditionReq)
	public static open(_context: PacketContext, _packet: PetExpeditionReq): Promise<CommandPetExpeditionPacketReq> {
		return asyncMakePacket(CommandPetExpeditionPacketReq, {});
	}

	@fromClientTranslator(PetExpeditionResolveReq)
	public static resolve(_context: PacketContext, _packet: PetExpeditionResolveReq): Promise<CommandPetExpeditionResolvePacketReq> {
		return asyncMakePacket(CommandPetExpeditionResolvePacketReq, {});
	}
}
