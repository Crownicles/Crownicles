import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandGetCurrentReactionCollectorsPacket,
	CommandGetCurrentReactionCollectorsPacketRes
} from "../../../../Lib/src/packets/commands/CommandGetCurrentReactionCollectorsPacket";
import { ReactionCollectorController } from "../../core/utils/ReactionsCollector";

export default class GetCurrentReactionCollectorsCommand {
	@commandRequires(CommandGetCurrentReactionCollectorsPacket, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[], player: Player, _packet: CommandGetCurrentReactionCollectorsPacket, _context: PacketContext): void {
		response.push(makePacket(CommandGetCurrentReactionCollectorsPacketRes, {
			collectors: ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId).map(c => c.build())
		}));
	}
}
