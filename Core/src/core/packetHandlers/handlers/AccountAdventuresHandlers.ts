import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandAccountAdventuresReq, CommandAccountAdventuresRes
} from "../../../../../Lib/src/packets/commands/CommandAccountAdventuresPacket";
import { Player } from "../../database/game/models/Player";
import { PacketUtils } from "../../utils/PacketUtils";

/** A player chooses between two accounts: never more to describe. */
const MAX_ACCOUNTS = 2;

function isAccountList(value: unknown): value is string[] {
	return Array.isArray(value) && value.length <= MAX_ACCOUNTS && value.every(id => typeof id === "string" && id.length > 0);
}

export default class AccountAdventuresHandlers {
	/** Read only: an account which never played must not get a character just for being described. */
	@packetHandler(CommandAccountAdventuresReq)
	async adventures(response: CrowniclesPacket[], _context: PacketContext, packet: CommandAccountAdventuresReq): Promise<void> {
		if (!isAccountList(packet.keycloakIds)) {
			PacketUtils.pushInternalError(response, "Invalid account list");
			return;
		}
		const players = await Player.findAll({ where: { keycloakId: packet.keycloakIds } });
		response.push(makePacket(CommandAccountAdventuresRes, {
			adventures: players.map(player => ({
				keycloakId: player.keycloakId, level: player.level, score: player.score, classId: player.class
			}))
		}));
	}
}
