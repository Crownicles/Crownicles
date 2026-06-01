import { packetHandler } from "../../../PacketHandler";
import { CommandEquipErrorNoItem } from "../../../../../../Lib/src/packets/commands/CommandEquipPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class EquipCommandPacketHandlers {
	@packetHandler(CommandEquipErrorNoItem)
	async equipErrorNoItem(context: PacketContext, _packet: CommandEquipErrorNoItem): Promise<void> {
		await handleClassicError(context, "commands:equip.noItems");
	}
}
