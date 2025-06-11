import { packetHandler } from "../../../PacketHandler";
import { CommandClassesInfoPacketRes } from "../../../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandClassesInfoPacketRes } from "../../../../commands/player/ClassesInfoCommand";

export default class ClassesInfoCommandPacketHandlers {
	@packetHandler(CommandClassesInfoPacketRes)
	async classesInfoRes(context: PacketContext, packet: CommandClassesInfoPacketRes): Promise<void> {
		await handleCommandClassesInfoPacketRes(packet, context);
	}
}
