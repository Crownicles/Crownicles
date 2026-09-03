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
			/*
			 * Collectors are built when they are opened and `build()` intentionally throws when called
			 * a second time. Reuse the already materialized creation packet when the mobile app
			 * reconnects and asks for the current collector state.
			 */
			collectors: ReactionCollectorController.getCollectorsOfPlayer(player.keycloakId).map(c => c.creationPacket)
		}));
	}
}
