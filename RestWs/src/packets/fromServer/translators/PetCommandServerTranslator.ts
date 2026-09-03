import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetPacketRes, CommandPetPetNotFound
} from "../../../../../Lib/src/packets/commands/CommandPetPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { PetRes } from "../../../../../WsPackets/src/fromServer/pet/PetRes";
import { PetNotFound } from "../../../../../WsPackets/src/fromServer/pet/PetNotFound";

export default class PetCommandServerTranslator {
	@fromServerTranslator(CommandPetPacketRes, PetRes)
	public static translate(_context: PacketContext, packet: CommandPetPacketRes): Promise<PetRes> {
		return asyncMakeFromServerPacket(PetRes, {
			pet: packet.pet,
			...packet.hasTalisman === undefined ? {} : { hasTalisman: packet.hasTalisman },
			...packet.expeditionInProgress === undefined ? {} : { expeditionInProgress: packet.expeditionInProgress }
		});
	}

	@fromServerTranslator(CommandPetPetNotFound, PetNotFound)
	public static translateNotFound(_context: PacketContext, _packet: CommandPetPetNotFound): Promise<PetNotFound> {
		return asyncMakeFromServerPacket(PetNotFound, {});
	}
}
