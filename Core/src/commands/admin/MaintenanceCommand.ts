import {
	CommandMaintenancePacketReq,
	CommandMaintenancePacketRes
} from "../../../../Lib/src/packets/commands/CommandMaintenancePacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { crowniclesInstance } from "../../index";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { adminCommand } from "../../core/utils/CommandUtils";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";

export default class MaintenanceCommand {
	@adminCommand(CommandMaintenancePacketReq, (context: PacketContext, _packet: CommandMaintenancePacketReq): boolean => {
		return !!context.rightGroups?.includes(RightGroup.ADMIN) || !!context.rightGroups?.includes(RightGroup.MAINTENANCE);
	})
	execute(response: CrowniclesPacket[], packet: CommandMaintenancePacketReq): void {
		try {
			crowniclesInstance.setMaintenance(packet.enable, packet.save);

			response.push(makePacket(CommandMaintenancePacketRes, { enabled: packet.enable }));
		}
		catch (err) {
			response.push(makePacket(ErrorPacket, { message: (err as Error).message }));
		}
	}
}
