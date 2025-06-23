import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandProfilePacketRes,
	CommandProfilePlayerNotFound
} from "../../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import { handleCommandProfilePacketRes } from "../../../../commands/player/ProfileCommand";

export default class ProfileCommandPacketHandlers {
	@packetHandler(CommandProfilePlayerNotFound)
	async profilePlayerNotFound(context: PacketContext, _packet: CommandProfilePlayerNotFound): Promise<void> {
		await handleClassicError(context, "error:playerDoesntExist", {}, { ephemeral: true });
	}

	@packetHandler(CommandProfilePacketRes)
	async profileRes(context: PacketContext, packet: CommandProfilePacketRes): Promise<void> {
		await handleCommandProfilePacketRes(packet, context);
	}
}
