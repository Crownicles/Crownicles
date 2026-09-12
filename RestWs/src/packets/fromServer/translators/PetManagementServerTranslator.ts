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
	CommandPetSellAlreadyHavePetError, CommandPetSellBadPriceErrorPacket, CommandPetSellCancelPacket,
	CommandPetSellCantSellToYourselfErrorPacket, CommandPetSellFeistyErrorPacket, CommandPetSellInitiatorSituationChangedErrorPacket,
	CommandPetSellNoOneAvailableErrorPacket, CommandPetSellNoPetErrorPacket, CommandPetSellNotEnoughMoneyError,
	CommandPetSellNotInGuildErrorPacket, CommandPetSellOnlyOwnerCanCancelErrorPacket, CommandPetSellPetOnExpeditionErrorPacket,
	CommandPetSellSameGuildError, CommandPetSellSuccessPacket
} from "../../../../../Lib/src/packets/commands/CommandPetSellPacket";
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
	@fromServerTranslator(CommandPetSellSuccessPacket, PetManagementRes)
	public static sold(_context: PacketContext, packet: CommandPetSellSuccessPacket): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "sold", ...packet
		} });
	}

	@fromServerTranslator(CommandPetSellBadPriceErrorPacket, PetManagementRes)
	public static salePrice(_context: PacketContext, packet: CommandPetSellBadPriceErrorPacket): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "salePrice", ...packet
		} });
	}

	@fromServerTranslator(CommandPetSellNotEnoughMoneyError, PetManagementRes)
	public static saleFunds(_context: PacketContext, packet: CommandPetSellNotEnoughMoneyError): Promise<PetManagementRes> {
		return asyncMakeFromServerPacket(PetManagementRes, { outcome: {
			type: "saleFunds", missingMoney: packet.missingMoney
		} });
	}

	@fromServerTranslator(CommandPetSellNoPetErrorPacket, PetManagementRes)
	public static saleNoPet(_context: PacketContext, _packet: CommandPetSellNoPetErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.NO_PET); }

	@fromServerTranslator(CommandPetSellPetOnExpeditionErrorPacket, PetManagementRes)
	public static saleExpedition(_context: PacketContext, _packet: CommandPetSellPetOnExpeditionErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.EXPEDITION); }

	@fromServerTranslator(CommandPetSellNotInGuildErrorPacket, PetManagementRes)
	public static saleNoGuild(_context: PacketContext, _packet: CommandPetSellNotInGuildErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.NO_GUILD); }

	@fromServerTranslator(CommandPetSellFeistyErrorPacket, PetManagementRes)
	public static saleFeisty(_context: PacketContext, _packet: CommandPetSellFeistyErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.FEISTY); }

	@fromServerTranslator(CommandPetSellOnlyOwnerCanCancelErrorPacket, PetManagementRes)
	public static saleOwnerOnly(_context: PacketContext, _packet: CommandPetSellOnlyOwnerCanCancelErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.OWNER_ONLY); }

	@fromServerTranslator(CommandPetSellCancelPacket, PetManagementRes)
	public static saleCancelled(_context: PacketContext, _packet: CommandPetSellCancelPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.CANCELLED); }

	@fromServerTranslator(CommandPetSellCantSellToYourselfErrorPacket, PetManagementRes)
	public static saleSelf(_context: PacketContext, _packet: CommandPetSellCantSellToYourselfErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.SELF); }

	@fromServerTranslator(CommandPetSellSameGuildError, PetManagementRes)
	public static saleSameGuild(_context: PacketContext, _packet: CommandPetSellSameGuildError): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.SAME_GUILD); }

	@fromServerTranslator(CommandPetSellAlreadyHavePetError, PetManagementRes)
	public static saleHasPet(_context: PacketContext, _packet: CommandPetSellAlreadyHavePetError): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.HAS_PET); }

	@fromServerTranslator(CommandPetSellInitiatorSituationChangedErrorPacket, PetManagementRes)
	public static saleChanged(_context: PacketContext, _packet: CommandPetSellInitiatorSituationChangedErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.CHANGED); }

	@fromServerTranslator(CommandPetSellNoOneAvailableErrorPacket, PetManagementRes)
	public static saleNoBuyer(_context: PacketContext, _packet: CommandPetSellNoOneAvailableErrorPacket): Promise<PetManagementRes> { return failure(PET_MANAGEMENT_ERRORS.NO_BUYER); }

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
