import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPetTransferPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { CommandPetFreePacketReq } from "../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { CommandPetSellPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetSellPacket";
import { CommandGuildShelterPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import {
	PetTransferReq, PetFreeReq, PetSellReq, GuildShelterReq
} from "../../../../../WsPackets/src/fromClient/PetManagementReq";
import { InvalidClientPacketError } from "../InvalidClientPacketError";

export default class PetManagementClientTranslator {
	@fromClientTranslator(PetSellReq)
	public static sell(_context: PacketContext, packet: PetSellReq): Promise<CommandPetSellPacketReq> {
		if (!Number.isSafeInteger(packet.rank) || packet.rank < 1) {
			throw new InvalidClientPacketError("Invalid pet sale request");
		}
		if (!Number.isSafeInteger(packet.price)) {
			throw new InvalidClientPacketError("Invalid pet sale request");
		}
		return asyncMakePacket(CommandPetSellPacketReq, {
			price: packet.price, askedPlayer: { rank: packet.rank }
		});
	}

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
