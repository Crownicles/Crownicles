import { packetHandler } from "../../../PacketHandler";
import { CommandInventoryPacketRes } from "../../../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandInventoryPacketRes } from "../../../../commands/player/InventoryCommand";

export default class InventoryCommandPacketHandlers {
	@packetHandler(CommandInventoryPacketRes)
	async inventoryRes(context: PacketContext, packet: CommandInventoryPacketRes): Promise<void> {
		await handleCommandInventoryPacketRes(packet, context);
	}
}
