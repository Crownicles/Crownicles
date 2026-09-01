import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { CommandTopPacketReq } from "../../../../Lib/src/packets/commands/CommandTopPacket";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import {
	getTopKind, getTopPacket, NO_GUILD_ID, TopKind, TopStorage
} from "../../core/utils/TopUtils";
import { CommandTournamentTopPacketRes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentManager } from "../../core/tournaments/TournamentManager";

export default class TopCommand {
	@commandRequires(CommandTopPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		tournamentAccess: "participant"
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		packet: CommandTopPacketReq,
		context: PacketContext
	): Promise<void> {
		if (await TournamentManager.getTournamentForContext(context)) {
			response.push(makePacket(CommandTournamentTopPacketRes, await TournamentManager.getTopData(context, player)));
			return;
		}
		const topKind = getTopKind(packet.dataType, packet.timing);
		const result = await TopStorage.getInstance()
			.askTop<typeof topKind>(
				topKind,
				topKind === TopKind.GUILDS ? player.guildId ?? NO_GUILD_ID : player.id,
				player.fightCountdown - FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE,
				packet.page
			);
		getTopPacket(response, result);
	}
}
