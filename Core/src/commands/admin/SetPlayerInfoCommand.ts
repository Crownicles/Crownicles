import { adminCommand } from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../../core/database/game/models/Player";
import {
	CommandSetPlayerInfoDoesntExistError,
	CommandSetPlayerInfoReq,
	CommandSetPlayerInfoRes
} from "../../../../Lib/src/packets/commands/CommandSetPlayerInfo";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";

/**
 * A command that modify information about a player
 * It is only used for admin management
 */
export default class SetPlayerInfoCommand {
	static verifyRights(context: PacketContext, packet: CommandSetPlayerInfoReq): boolean {
		// Admin can set everything
		if (context.rightGroups?.includes(RightGroup.ADMIN)) {
			return true;
		}

		// Players who have the right to set badges can access the badges only
		return Object.keys(packet.dataToSet).length === 1 && !!packet.dataToSet.badges && !!context.rightGroups?.includes(RightGroup.BADGES);
	}

	@adminCommand(CommandSetPlayerInfoReq, SetPlayerInfoCommand.verifyRights)
	async execute(response: CrowniclesPacket[], packet: CommandSetPlayerInfoReq): Promise<void> {
		const player = await Players.getByKeycloakId(packet.keycloakId);

		if (!player) {
			response.push(makePacket(CommandSetPlayerInfoDoesntExistError, {}));
			return;
		}

		if (packet.dataToSet.badges) {
			await PlayerBadgesManager.setBadges(player.id, packet.dataToSet.badges);
		}

		await player.save();

		response.push(makePacket(CommandSetPlayerInfoRes, {
			keycloakId: packet.keycloakId
		}));
	}
}
