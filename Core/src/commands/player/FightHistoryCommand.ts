import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandFightHistoryPacketReq,
	CommandFightHistoryPacketRes
} from "../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { LogsFightHistoryRequests } from "../../core/database/logs/requests/LogsFightHistoryRequests";
import { MissionsController } from "../../core/missions/MissionsController";

export default class FightHistoryCommand {
	@commandRequires(CommandFightHistoryPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		level: FightConstants.REQUIRED_LEVEL
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandFightHistoryPacketRes, _context: PacketContext): Promise<void> {
		response.push(makePacket(CommandFightHistoryPacketRes, {
			history: await LogsFightHistoryRequests.getFightHistory(player.keycloakId, FightConstants.HISTORY_LIMIT)
		}));

		// Update the mission for using the fighthistory command
		await MissionsController.update(player, response, { missionId: "commandFightHistory" });
	}
}
