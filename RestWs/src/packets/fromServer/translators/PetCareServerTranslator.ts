import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPetCaressPacketRes } from "../../../../../Lib/src/packets/commands/CommandPetPacket";
import { CommandPetNickPacketRes } from "../../../../../Lib/src/packets/commands/CommandPetNickPacket";
import {
	CommandPetFeedCancelErrorPacket, CommandPetFeedGuildStorageEmptyErrorPacket, CommandPetFeedNoMoneyFeedErrorPacket,
	CommandPetFeedNoPetErrorPacket, CommandPetFeedNotHungryErrorPacket, CommandPetFeedPetOnExpeditionErrorPacket,
	CommandPetFeedSituationChangedErrorPacket, CommandPetFeedSuccessPacket
} from "../../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import {
	PetCaressRes, PetFeedRes, PetNickRes
} from "../../../../../WsPackets/src/fromServer/pet/PetCareRes";
import { PET_FEED_ERRORS } from "../../../../../WsPackets/src/objects/PetFood";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class PetCareServerTranslator {
	@fromServerTranslator(CommandPetCaressPacketRes, PetCaressRes)
	public static caress(_context: PacketContext, _packet: CommandPetCaressPacketRes): Promise<PetCaressRes> {
		return asyncMakeFromServerPacket(PetCaressRes, {});
	}

	@fromServerTranslator(CommandPetNickPacketRes, PetNickRes)
	public static nickname(_context: PacketContext, packet: CommandPetNickPacketRes): Promise<PetNickRes> {
		return asyncMakeFromServerPacket(PetNickRes, { ...packet });
	}

	@fromServerTranslator(CommandPetFeedSuccessPacket, PetFeedRes)
	public static fed(_context: PacketContext, packet: CommandPetFeedSuccessPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: true, result: packet.result
		} });
	}

	@fromServerTranslator(CommandPetFeedNoPetErrorPacket, PetFeedRes)
	public static noPet(_context: PacketContext, _packet: CommandPetFeedNoPetErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.NO_PET
		} });
	}

	@fromServerTranslator(CommandPetFeedNotHungryErrorPacket, PetFeedRes)
	public static notHungry(_context: PacketContext, packet: CommandPetFeedNotHungryErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.NOT_HUNGRY, pet: packet.pet
		} });
	}

	@fromServerTranslator(CommandPetFeedPetOnExpeditionErrorPacket, PetFeedRes)
	public static expedition(_context: PacketContext, _packet: CommandPetFeedPetOnExpeditionErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.EXPEDITION
		} });
	}

	@fromServerTranslator(CommandPetFeedNoMoneyFeedErrorPacket, PetFeedRes)
	public static noMoney(_context: PacketContext, _packet: CommandPetFeedNoMoneyFeedErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.NO_MONEY
		} });
	}

	@fromServerTranslator(CommandPetFeedGuildStorageEmptyErrorPacket, PetFeedRes)
	public static emptyStorage(_context: PacketContext, _packet: CommandPetFeedGuildStorageEmptyErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.EMPTY_STORAGE
		} });
	}

	@fromServerTranslator(CommandPetFeedSituationChangedErrorPacket, PetFeedRes)
	public static situationChanged(_context: PacketContext, _packet: CommandPetFeedSituationChangedErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.SITUATION_CHANGED
		} });
	}

	@fromServerTranslator(CommandPetFeedCancelErrorPacket, PetFeedRes)
	public static cancelled(_context: PacketContext, _packet: CommandPetFeedCancelErrorPacket): Promise<PetFeedRes> {
		return asyncMakeFromServerPacket(PetFeedRes, { outcome: {
			success: false, error: PET_FEED_ERRORS.CANCELLED
		} });
	}
}
