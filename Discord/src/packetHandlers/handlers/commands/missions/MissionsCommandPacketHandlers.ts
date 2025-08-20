import { packetHandler } from "../../../PacketHandler";
import {
	CommandMissionPlayerNotFoundPacket,
	CommandMissionsPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandMissionPlayerNotFoundPacket,
	handleCommandMissionsPacketRes
} from "../../../../commands/mission/MissionsCommand";

export default class MissionsCommandPacketHandlers {
	@packetHandler(CommandMissionPlayerNotFoundPacket)
	async commandMissionPlayerNotFound(context: PacketContext, _packet: CommandMissionPlayerNotFoundPacket): Promise<void> {
		await handleCommandMissionPlayerNotFoundPacket(context);
	}

	@packetHandler(CommandMissionsPacketRes)
	async missionsCommandRes(context: PacketContext, packet: CommandMissionsPacketRes): Promise<void> {
		await handleCommandMissionsPacketRes(packet, context);
	}
}
