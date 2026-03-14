import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { CommandTopPacketReq } from "../../../../Lib/src/packets/commands/CommandTopPacket";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import {
	getTopKind, getTopPacket, TopKind, TopStorage
} from "../../core/utils/TopUtils";

export default class TopCommand {
	@commandRequires(CommandTopPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static execute(
		response: CrowniclesPacket[],
		player: Player,
		packet: CommandTopPacketReq
	): void {
		const topKind = getTopKind(packet.dataType, packet.timing);
		const result = TopStorage.getInstance()
			.askTop<typeof topKind>(
				topKind,
				topKind === TopKind.GUILDS ? player.guildId ?? -1 : player.id,
				packet.page ?? 1,
				player.fightCountdown - FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE
			);
		getTopPacket(response, result);
	}
}
