import { packetHandler } from "../../../PacketHandler";
import { CommandMapDisplayRes } from "../../../../../../Lib/src/packets/commands/CommandMapPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandMapDisplayRes } from "../../../../commands/player/MapCommand";

export default class MapDisplayCommandPacketHandlers {
	@packetHandler(CommandMapDisplayRes)
	async mapRes(context: PacketContext, packet: CommandMapDisplayRes): Promise<void> {
		await handleCommandMapDisplayRes(packet, context);
	}
}
