import { adminCommand } from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../../core/database/game/models/Player";
import {
	CommandGetPlayerInfoReq,
	CommandGetPlayerInfoRes
} from "../../../../Lib/src/packets/commands/CommandGetPlayerInfo";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";

/**
 * A command that returns information about a player
 * It is only used for admin management
 */
export default class GetPlayerInfoCommand {
	static verifyRights(context: PacketContext, packet: CommandGetPlayerInfoReq): boolean {
		// Admin can set everything
		if (context.rightGroups?.includes(RightGroup.ADMIN)) {
			return true;
		}

		// Players who have the right to set badges can access the badges only
		return Object.keys(packet.dataToGet).length === 1 && !!packet.dataToGet.badges && !!context.rightGroups?.includes(RightGroup.BADGES);
	}

	@adminCommand(CommandGetPlayerInfoReq, GetPlayerInfoCommand.verifyRights)
	async execute(response: CrowniclesPacket[], packet: CommandGetPlayerInfoReq): Promise<void> {
		const player = await Players.getByKeycloakId(packet.keycloakId);

		const res = makePacket(CommandGetPlayerInfoRes, {
			exists: Boolean(player), data: {}
		});

		if (!player) {
			response.push(res);
			return;
		}

		if (packet.dataToGet.badges) {
			res.data.badges = await PlayerBadgesManager.getOfPlayer(player.id);
		}

		response.push(res);
	}
}
