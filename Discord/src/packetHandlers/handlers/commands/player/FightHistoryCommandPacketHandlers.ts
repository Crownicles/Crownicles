import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandFightHistoryPacketRes } from "../../../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { handlePacketHistoryRes } from "../../../../commands/player/FightHistoryCommand";

export default class FightHistoryCommandPacketHandlers {
	@packetHandler(CommandFightHistoryPacketRes)
	async inventoryRes(context: PacketContext, packet: CommandFightHistoryPacketRes): Promise<void> {
		await handlePacketHistoryRes(packet, context);
	}
}
