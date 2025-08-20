import { packetHandler } from "../../../PacketHandler";
import { CommandTestPacketRes } from "../../../../../../Lib/src/packets/commands/CommandTestPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandTestPacketRes } from "../../../../commands/admin/TestCommand";

export default class TestCommandPacketHandlers {
	@packetHandler(CommandTestPacketRes)
	async testRes(context: PacketContext, packet: CommandTestPacketRes): Promise<void> {
		await handleCommandTestPacketRes(packet, context);
	}
}
