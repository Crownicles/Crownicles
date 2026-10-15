import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPetCaressPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetPacket";
import { CommandPetNickPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { CommandPetFeedPacketReq } from "../../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import {
	PetCaressReq, PetFeedReq, PetNickReq
} from "../../../../../WsPackets/src/fromClient/PetCareReq";

export default class PetCareClientTranslator {
	@fromClientTranslator(PetCaressReq)
	public static caress(_context: PacketContext, _packet: PetCaressReq): Promise<CommandPetCaressPacketReq> {
		return asyncMakePacket(CommandPetCaressPacketReq, {});
	}

	@fromClientTranslator(PetFeedReq)
	public static feed(_context: PacketContext, _packet: PetFeedReq): Promise<CommandPetFeedPacketReq> {
		return asyncMakePacket(CommandPetFeedPacketReq, {});
	}

	@fromClientTranslator(PetNickReq)
	public static nickname(context: PacketContext, packet: PetNickReq): Promise<CommandPetNickPacketReq> {
		if (packet.newNickname !== undefined && typeof packet.newNickname !== "string") {
			throw new InvalidClientPacketError("Invalid pet nickname");
		}
		return asyncMakePacket(CommandPetNickPacketReq, {
			keycloakId: context.keycloakId!, ...packet.newNickname === undefined ? {} : { newNickname: packet.newNickname }
		});
	}
}
