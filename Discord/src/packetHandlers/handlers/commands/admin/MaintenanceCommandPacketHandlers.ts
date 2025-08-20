import { packetHandler } from "../../../PacketHandler";
import { CommandMaintenancePacketRes } from "../../../../../../Lib/src/packets/commands/CommandMaintenancePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandMaintenancePacketRes } from "../../../../commands/admin/MaintenanceCommand";

export default class MaintenanceCommandPacketHandlers {
	@packetHandler(CommandMaintenancePacketRes)
	async maintenanceReq(context: PacketContext, packet: CommandMaintenancePacketRes): Promise<void> {
		await handleCommandMaintenancePacketRes(packet, context);
	}
}
