import { packetHandler } from "../../../PacketHandler";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketRes,
	CommandPetFreeRefusePacketRes,
	CommandPetFreeShelterSuccessPacketRes,
	CommandPetFreeShelterCooldownErrorPacketRes,
	CommandPetFreeShelterMissingMoneyErrorPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandPetFreeAcceptPacketRes,
	handleCommandPetFreePacketRes,
	handleCommandPetFreeRefusePacketRes,
	handleCommandPetFreeShelterSuccessPacketRes,
	handleCommandPetFreeShelterCooldownErrorPacketRes,
	handleCommandPetFreeShelterMissingMoneyErrorPacketRes
} from "../../../../commands/pet/PetFreeCommand";

export default class PetFreeCommandPacketHandlers {
	@packetHandler(CommandPetFreePacketRes)
	async petFreeRes(context: PacketContext, packet: CommandPetFreePacketRes): Promise<void> {
		await handleCommandPetFreePacketRes(packet, context);
	}

	@packetHandler(CommandPetFreeRefusePacketRes)
	async petFreeRefuseRes(context: PacketContext, _packet: CommandPetFreeRefusePacketRes): Promise<void> {
		await handleCommandPetFreeRefusePacketRes(context);
	}

	@packetHandler(CommandPetFreeAcceptPacketRes)
	async petFreeAcceptRes(context: PacketContext, packet: CommandPetFreeAcceptPacketRes): Promise<void> {
		await handleCommandPetFreeAcceptPacketRes(packet, context);
	}

	@packetHandler(CommandPetFreeShelterSuccessPacketRes)
	async petFreeShelterSuccessRes(context: PacketContext, packet: CommandPetFreeShelterSuccessPacketRes): Promise<void> {
		await handleCommandPetFreeShelterSuccessPacketRes(packet, context);
	}

	@packetHandler(CommandPetFreeShelterCooldownErrorPacketRes)
	async petFreeShelterCooldownErrorRes(context: PacketContext, packet: CommandPetFreeShelterCooldownErrorPacketRes): Promise<void> {
		await handleCommandPetFreeShelterCooldownErrorPacketRes(packet, context);
	}

	@packetHandler(CommandPetFreeShelterMissingMoneyErrorPacketRes)
	async petFreeShelterMissingMoneyErrorRes(context: PacketContext, packet: CommandPetFreeShelterMissingMoneyErrorPacketRes): Promise<void> {
		await handleCommandPetFreeShelterMissingMoneyErrorPacketRes(packet, context);
	}
}
