import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import LeagueRewardCommand from "../../../player/LeagueRewardCommand";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandLeagueRewardPacketReq } from "../../../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";

export const commandInfo: ITestCommand = {
	name: "leaguereward",
	description: "Exécute la commande leaguereward sans tenir compte de la date"
};

const leagueRewardTestCommand: ExecuteTestCommandLike = async (player, _args, response: CrowniclesPacket[], context: PacketContext) => {
	await LeagueRewardCommand.execute(response, player, makePacket(CommandLeagueRewardPacketReq, {}), context, true);

	return "Vous avez exécuté la commande leaguereward !";
};

commandInfo.execute = leagueRewardTestCommand;
