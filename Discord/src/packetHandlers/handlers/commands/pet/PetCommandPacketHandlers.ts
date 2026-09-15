import { packetHandler } from "../../../PacketHandler";
import {
	CommandPetCaressPacketRes, CommandPetPacketRes, CommandPetPetNotFound, CommandPetPowersPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandPetPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandPetPacketRes } from "../../../../commands/pet/PetCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class PetCommandPacketHandlers {
	@packetHandler(CommandPetPowersPacketRes)
	petPowers(_context: PacketContext, _packet: CommandPetPowersPacketRes): Promise<void> {
		return Promise.resolve();
	}

	@packetHandler(CommandPetCaressPacketRes)
	petCaressAcknowledged(_context: PacketContext, _packet: CommandPetCaressPacketRes): Promise<void> {
		return Promise.resolve();
	}

	@packetHandler(CommandPetPacketRes)
	async petRes(context: PacketContext, packet: CommandPetPacketRes): Promise<void> {
		await handleCommandPetPacketRes(packet, context);
	}

	@packetHandler(CommandPetPetNotFound)
	async petNotFound(context: PacketContext, _packet: CommandPetPetNotFound): Promise<void> {
		await handleClassicError(context, "error:petDoesntExist");
	}
}
