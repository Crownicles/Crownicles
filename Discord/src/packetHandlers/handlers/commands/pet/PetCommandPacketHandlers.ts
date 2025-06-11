import { packetHandler } from "../../../PacketHandler";
import {
	CommandPetPacketRes, CommandPetPetNotFound
} from "../../../../../../Lib/src/packets/commands/CommandPetPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandPetPacketRes } from "../../../../commands/pet/PetCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class PetCommandPacketHandlers {
	@packetHandler(CommandPetPacketRes)
	async petRes(context: PacketContext, packet: CommandPetPacketRes): Promise<void> {
		await handleCommandPetPacketRes(packet, context);
	}

	@packetHandler(CommandPetPetNotFound)
	async petNotFound(context: PacketContext, _packet: CommandPetPetNotFound): Promise<void> {
		await handleClassicError(context, "error:petDoesntExist");
	}
}
