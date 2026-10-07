import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandAdventureHistoryReq, CommandAdventureHistoryRes
} from "../../../../Lib/src/packets/commands/CommandAdventureHistoryPacket";
import { AdventureHistoryConstants } from "../../../../Lib/src/constants/AdventureHistoryConstants";
import {
	asSeconds, getDateLogs
} from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import Player from "../../core/database/game/models/Player";
import { getAdventureHistory } from "../../core/database/logs/requests/LogsAdventureHistoryRequests";

export default class AdventureHistoryCommand {
	@commandRequires(CommandAdventureHistoryReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandAdventureHistoryReq, _context: PacketContext): Promise<void> {
		const windowStartsAt = asSeconds(getDateLogs() - AdventureHistoryConstants.WINDOW_SECONDS);
		try {
			const history = await getAdventureHistory(player.keycloakId, packet.page, packet.until);
			response.push(makePacket(CommandAdventureHistoryRes, {
				...history, windowStartsAt, available: true
			}));
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Failed to read adventure history", error);
			response.push(makePacket(CommandAdventureHistoryRes, {
				available: false,
				entries: [],
				until: asSeconds(getDateLogs() - 1),
				windowStartsAt
			}));
		}
	}
}
