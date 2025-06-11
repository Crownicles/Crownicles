import { packetHandler } from "../../../PacketHandler";
import { CommandPetNickPacketRes } from "../../../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandPetNickPacketRes } from "../../../../commands/pet/PetNickCommand";

export default class PetNickCommandPacketHandlers {
	@packetHandler(CommandPetNickPacketRes)
	async PetNickPacketRes(context: PacketContext, packet: CommandPetNickPacketRes): Promise<void> {
		await handleCommandPetNickPacketRes(packet, context);
	}
}
