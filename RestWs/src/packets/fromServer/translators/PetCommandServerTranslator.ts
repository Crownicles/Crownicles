import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetPacketRes, CommandPetPetNotFound
} from "../../../../../Lib/src/packets/commands/CommandPetPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { PetRes } from "../../../../../WsPackets/src/fromServer/pet/PetRes";
import { PetNotFound } from "../../../../../WsPackets/src/fromServer/pet/PetNotFound";
import { getRiskCategoryName } from "../../../../../Lib/src/utils/ExpeditionUtils";

export default class PetCommandServerTranslator {
	@fromServerTranslator(CommandPetPacketRes, PetRes)
	public static translate(_context: PacketContext, packet: CommandPetPacketRes): Promise<PetRes> {
		return asyncMakeFromServerPacket(PetRes, {
			pet: packet.pet,
			...packet.hasTalisman === undefined ? {} : { hasTalisman: packet.hasTalisman },
			...packet.feedAvailableAt === undefined ? {} : { feedAvailableAt: packet.feedAvailableAt },
			...packet.expeditionInProgress === undefined
				? {}
				: {
					expeditionInProgress: {
						...packet.expeditionInProgress, riskCategory: getRiskCategoryName(packet.expeditionInProgress.riskRate)
					}
				},
			...packet.expeditionBlocker === undefined ? {} : { expeditionBlocker: packet.expeditionBlocker }
		});
	}

	@fromServerTranslator(CommandPetPetNotFound, PetNotFound)
	public static translateNotFound(_context: PacketContext, _packet: CommandPetPetNotFound): Promise<PetNotFound> {
		return asyncMakeFromServerPacket(PetNotFound, {});
	}
}
