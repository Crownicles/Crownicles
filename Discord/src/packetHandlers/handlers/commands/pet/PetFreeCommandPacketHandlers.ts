import { packetHandler } from "../../../PacketHandler";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketRes,
	CommandPetFreeRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandPetFreeAcceptPacketRes,
	handleCommandPetFreePacketRes,
	handleCommandPetFreeRefusePacketRes
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
}
