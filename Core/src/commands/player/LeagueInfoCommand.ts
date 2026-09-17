import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandLeagueInfoReq, CommandLeagueInfoRes
} from "../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import { Player } from "../../core/database/game/models/Player";
import { LeagueDataController } from "../../data/League";

export default class LeagueInfoCommand {
	@commandRequires(CommandLeagueInfoReq, {
		notBlocked: false, whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	public async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		response.push(makePacket(CommandLeagueInfoRes, {
			currentLeagueId: player.getLeague().id,
			glory: player.getGloryPoints(),
			rewardAvailability: await player.getLeagueRewardAvailability(),
			leagues: LeagueDataController.instance.getAllValues().sort((first, second) => first.minGloryPoints - second.minGloryPoints)
				.map(league => ({
					id: league.id,
					minGloryPoints: Math.max(0, league.minGloryPoints),
					maxGloryPoints: league.maxGloryPoints,
					money: league.getMoneyToAward(),
					xp: league.getXPToAward(),
					winMoney: league.getFightWinMoneyReward()
				}))
		}));
	}
}
