import { adminCommand } from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGetResourcesReq,
	CommandGetResourcesRes
} from "../../../../Lib/src/packets/commands/CommandGetResourcesPacket";
import { Badge } from "../../../../Lib/src/types/Badge";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";

/**
 * A command that returns resources of the game
 * It is only used to list resources for admin management
 */
export default class GetResourcesCommand {
	static verifyRights(context: PacketContext, packet: CommandGetResourcesReq): boolean {
		// Admin can access everything
		if (context.rightGroups?.includes(RightGroup.ADMIN)) {
			return true;
		}

		// Players who have the right to see badges can access the badges only
		return Object.keys(packet).length === 1 && !!packet.badges && !!context.rightGroups?.includes(RightGroup.BADGES);
	}

	@adminCommand(CommandGetResourcesReq, GetResourcesCommand.verifyRights)
	execute(response: CrowniclesPacket[], packet: CommandGetResourcesReq): void {
		const res = makePacket(CommandGetResourcesRes, {});

		if (packet.badges) {
			res.badges = Object.values(Badge);
		}

		response.push(res);
	}
}
