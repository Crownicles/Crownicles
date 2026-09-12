import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPetTransferPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { CommandPetFreePacketReq } from "../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { CommandGuildShelterPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import {
	PetTransferReq, PetFreeReq, GuildShelterReq
} from "../../../../../WsPackets/src/fromClient/PetManagementReq";

export default class PetManagementClientTranslator {
	@fromClientTranslator(PetTransferReq)
	public static transfer(_context: PacketContext, _packet: PetTransferReq): Promise<CommandPetTransferPacketReq> {
		return asyncMakePacket(CommandPetTransferPacketReq, {});
	}

	@fromClientTranslator(PetFreeReq)
	public static free(context: PacketContext, _packet: PetFreeReq): Promise<CommandPetFreePacketReq> {
		return asyncMakePacket(CommandPetFreePacketReq, { keycloakId: context.keycloakId! });
	}

	@fromClientTranslator(GuildShelterReq)
	public static shelter(_context: PacketContext, _packet: GuildShelterReq): Promise<CommandGuildShelterPacketReq> {
		return asyncMakePacket(CommandGuildShelterPacketReq, {});
	}
}
