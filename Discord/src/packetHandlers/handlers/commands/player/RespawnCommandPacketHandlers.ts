import { packetHandler } from "../../../PacketHandler";
import {
	CommandRespawnErrorAlreadyAlive,
	CommandRespawnPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandRespawnPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandRespawnPacketRes } from "../../../../commands/player/RespawnCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class RespawnCommandPacketHandlers {
	@packetHandler(CommandRespawnPacketRes)
	async respawnRes(context: PacketContext, packet: CommandRespawnPacketRes): Promise<void> {
		await handleCommandRespawnPacketRes(packet, context);
	}

	@packetHandler(CommandRespawnErrorAlreadyAlive)
	async respawnErrorAlreadyAlive(context: PacketContext, _packet: CommandRespawnErrorAlreadyAlive): Promise<void> {
		await handleClassicError(context, "commands:respawn.alreadyAlive");
	}
}
