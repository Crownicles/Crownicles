import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetTransferAnotherMemberTransferringErrorPacket,
	CommandPetTransferCancelErrorPacket,
	CommandPetTransferSituationChangedErrorPacket,
	CommandPetTransferNoPetErrorPacket,
	CommandPetTransferFeistyErrorPacket,
	CommandPetTransferPetOnExpeditionErrorPacket,
	CommandPetTransferSuccessPacket
} from "../../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import {
	CommandPetFreePacketRes,
	CommandPetFreeRefusePacketRes,
	CommandPetFreeAcceptPacketRes,
	CommandPetFreeShelterSuccessPacketRes,
	CommandPetFreeShelterCooldownErrorPacketRes,
	CommandPetFreeShelterMissingMoneyErrorPacketRes
} from "../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import {
	CommandGuildShelterPacketRes, CommandGuildShelterNoPetErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import {
	PetManagementRes, GuildShelterRes, GuildShelterEmptyRes
} from "../../../../../WsPackets/src/fromServer/pet/PetManagementRes";
import {
	PET_MANAGEMENT_ERRORS, PetManagementError
} from "../../../../../WsPackets/src/objects/PetManagement";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

function failure(error: PetManagementError): Promise<PetManagementRes> {
	return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
		type: "error", error
	} });
}
function freedPet(packet: CommandPetFreeAcceptPacketRes, isFromShelter: boolean): Promise<PetManagementRes> {
	return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
		type: "freed",
		freeCost: packet.freeCost,
		luckyMeat: packet.luckyMeat,
		isFromShelter,
		pet: {
			petTypeId: packet.petId, petSex: packet.petSex, ...packet.petNickname ? { petNickname: packet.petNickname } : {}
		}
	} });
}

export default class PetManagementServerTranslator {
	@fromServerTranslator(CommandGuildShelterPacketRes, GuildShelterRes)
	public static shelter(_context: PacketContext, packet: CommandGuildShelterPacketRes): Promise<GuildShelterRes> {
		return asyncMakeFromServerPacket(GuildShelterRes, { ...packet });
	}

	@fromServerTranslator(CommandGuildShelterNoPetErrorPacket, GuildShelterEmptyRes)
	public static emptyShelter(_context: PacketContext, _packet: CommandGuildShelterNoPetErrorPacket): Promise<GuildShelterEmptyRes> {
		return asyncMakeFromServerPacket(GuildShelterEmptyRes, {});
	}

	@fromServerTranslator(CommandPetTransferSuccessPacket, PetManagementRes)
	public static transferred(_context: PacketContext, packet: CommandPetTransferSuccessPacket): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "transfer", ...packet
		} });
	}

	@fromServerTranslator(CommandPetFreePacketRes, PetManagementRes)
	public static freeStatus(_context: PacketContext, packet: CommandPetFreePacketRes): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "freeStatus",
			status: {
				foundPet: packet.foundPet,
				...packet.petCanBeFreed === undefined ? {} : { petCanBeFreed: packet.petCanBeFreed },
				...packet.missingMoney === undefined ? {} : { missingMoney: packet.missingMoney },
				...packet.cooldownRemainingTimeMs === undefined ? {} : { cooldownRemainingTimeMs: packet.cooldownRemainingTimeMs },
				...packet.petOnExpedition === undefined ? {} : { petOnExpedition: packet.petOnExpedition }
			}
		} });
	}

	@fromServerTranslator(CommandPetFreeAcceptPacketRes, PetManagementRes)
	public static freed(_context: PacketContext, packet: CommandPetFreeAcceptPacketRes): Promise<PetManagementRes> {
		return freedPet(packet, false);
	}

	@fromServerTranslator(CommandPetFreeShelterSuccessPacketRes, PetManagementRes)
	public static freedShelter(_context: PacketContext, packet: CommandPetFreeShelterSuccessPacketRes): Promise<PetManagementRes> {
		return freedPet(packet, true);
	}

	@fromServerTranslator(CommandPetFreeShelterCooldownErrorPacketRes, PetManagementRes)
	public static freeCooldown(_context: PacketContext, packet: CommandPetFreeShelterCooldownErrorPacketRes): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "freeStatus",
			status: {
				foundPet: true, petCanBeFreed: false, cooldownRemainingTimeMs: packet.cooldownRemainingTimeMs
			}
		} });
	}

	@fromServerTranslator(CommandPetFreeShelterMissingMoneyErrorPacketRes, PetManagementRes)
	public static freeMissingMoney(_context: PacketContext, packet: CommandPetFreeShelterMissingMoneyErrorPacketRes): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "freeStatus",
			status: {
				foundPet: true, petCanBeFreed: false, missingMoney: packet.missingMoney
			}
		} });
	}

	@fromServerTranslator(CommandPetTransferAnotherMemberTransferringErrorPacket, PetManagementRes)
	public static busy(_context: PacketContext, _packet: CommandPetTransferAnotherMemberTransferringErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.BUSY); }

	@fromServerTranslator(CommandPetTransferCancelErrorPacket, PetManagementRes)
	public static cancelled(_context: PacketContext, _packet: CommandPetTransferCancelErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.CANCELLED); }

	@fromServerTranslator(CommandPetFreeRefusePacketRes, PetManagementRes)
	public static refusedFree(_context: PacketContext, _packet: CommandPetFreeRefusePacketRes): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.CANCELLED); }

	@fromServerTranslator(CommandPetTransferSituationChangedErrorPacket, PetManagementRes)
	public static changed(_context: PacketContext, _packet: CommandPetTransferSituationChangedErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.CHANGED); }

	@fromServerTranslator(CommandPetTransferNoPetErrorPacket, PetManagementRes)
	public static noPet(_context: PacketContext, _packet: CommandPetTransferNoPetErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.NO_PET); }

	@fromServerTranslator(CommandPetTransferFeistyErrorPacket, PetManagementRes)
	public static feisty(_context: PacketContext, _packet: CommandPetTransferFeistyErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.FEISTY); }

	@fromServerTranslator(CommandPetTransferPetOnExpeditionErrorPacket, PetManagementRes)
	public static expedition(_context: PacketContext, _packet: CommandPetTransferPetOnExpeditionErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.EXPEDITION); }
}
