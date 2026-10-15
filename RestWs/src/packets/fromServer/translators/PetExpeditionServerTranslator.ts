import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetExpeditionPacketRes, CommandPetExpeditionChoicePacketRes, CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes, CommandPetExpeditionResolvePacketRes, CommandPetExpeditionErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	PetExpeditionRes, PetExpeditionStartedRes, PetExpeditionCancelRes, PetExpeditionRecallRes, PetExpeditionResolveRes, PetExpeditionErrorRes
} from "../../../../../WsPackets/src/fromServer/pet/PetExpeditionRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	expeditionError, expeditionLocation, expeditionProgress
} from "../collectors/ExpeditionDataMapper";

export default class PetExpeditionServerTranslator {
	@fromServerTranslator(CommandPetExpeditionPacketRes, PetExpeditionRes)
	public static status(_context: PacketContext, packet: CommandPetExpeditionPacketRes): Promise<PetExpeditionRes> {
		return asyncMakeFromServerPacket(PetExpeditionRes, {
			hasTalisman: packet.hasTalisman,
			hasExpeditionInProgress: packet.hasExpeditionInProgress,
			canStartExpedition: packet.canStartExpedition,
			...packet.expeditionInProgress ? { expeditionInProgress: expeditionProgress(packet.expeditionInProgress) } : {},
			...packet.cannotStartReason ? { cannotStartReason: expeditionError(packet.cannotStartReason) } : {},
			...packet.pet ? { pet: packet.pet } : {}
		});
	}

	@fromServerTranslator(CommandPetExpeditionChoicePacketRes, PetExpeditionStartedRes)
	public static started(_context: PacketContext, packet: CommandPetExpeditionChoicePacketRes): Promise<PetExpeditionStartedRes> {
		return asyncMakeFromServerPacket(PetExpeditionStartedRes, {
			success: packet.success,
			...packet.failureReason ? { failureReason: expeditionError(packet.failureReason) } : {},
			...packet.expedition ? { expedition: expeditionProgress(packet.expedition) } : {},
			...packet.foodConsumed === undefined ? {} : { foodConsumed: packet.foodConsumed },
			...packet.foodConsumedDetails ? { foodConsumedDetails: packet.foodConsumedDetails } : {},
			...packet.insufficientFood === undefined ? {} : { insufficientFood: packet.insufficientFood },
			...packet.insufficientFoodCause ? { insufficientFoodCause: packet.insufficientFoodCause } : {},
			...packet.originalDisplayDurationMinutes === undefined ? {} : { originalDisplayDurationMinutes: packet.originalDisplayDurationMinutes }
		});
	}

	@fromServerTranslator(CommandPetExpeditionCancelPacketRes, PetExpeditionCancelRes)
	public static cancel(_context: PacketContext, packet: CommandPetExpeditionCancelPacketRes): Promise<PetExpeditionCancelRes> {
		return asyncMakeFromServerPacket(PetExpeditionCancelRes, { ...packet });
	}

	@fromServerTranslator(CommandPetExpeditionRecallPacketRes, PetExpeditionRecallRes)
	public static recall(_context: PacketContext, packet: CommandPetExpeditionRecallPacketRes): Promise<PetExpeditionRecallRes> {
		return asyncMakeFromServerPacket(PetExpeditionRecallRes, { ...packet });
	}

	@fromServerTranslator(CommandPetExpeditionResolvePacketRes, PetExpeditionResolveRes)
	public static resolved(_context: PacketContext, packet: CommandPetExpeditionResolvePacketRes): Promise<PetExpeditionResolveRes> {
		return asyncMakeFromServerPacket(PetExpeditionResolveRes, {
			...packet, expedition: expeditionLocation(packet.expedition)
		});
	}

	@fromServerTranslator(CommandPetExpeditionErrorPacket, PetExpeditionErrorRes)
	public static error(_context: PacketContext, packet: CommandPetExpeditionErrorPacket): Promise<PetExpeditionErrorRes> {
		return asyncMakeFromServerPacket(PetExpeditionErrorRes, { errorCode: expeditionError(packet.errorCode) });
	}
}
