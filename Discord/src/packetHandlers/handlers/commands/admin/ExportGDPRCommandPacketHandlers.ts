import { packetHandler } from "../../../PacketHandler";
import { CommandExportGDPRRes } from "../../../../../../Lib/src/packets/commands/CommandExportGDPRPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandExportGDPRRes } from "../../../../commands/admin/ExportGDPRCommand";

export default class ExportGDPRCommandPacketHandlers {
	@packetHandler(CommandExportGDPRRes)
	async exportGDPRRes(context: PacketContext, packet: CommandExportGDPRRes): Promise<void> {
		await handleCommandExportGDPRRes(context, packet);
	}
}
