import { packetHandler } from "../../../PacketHandler";
import { CommandUpdatePacketRes } from "../../../../../../Lib/src/packets/commands/CommandUpdatePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandUpdatePacketRes } from "../../../../commands/player/UpdateCommand";

export default class UpdateCommandPacketHandlers {
	@packetHandler(CommandUpdatePacketRes)
	async updateRes(context: PacketContext, packet: CommandUpdatePacketRes): Promise<void> {
		await handleCommandUpdatePacketRes(packet, context);
	}
}
