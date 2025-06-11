import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandLeagueRewardAlreadyClaimedPacketRes,
	CommandLeagueRewardNoPointsPacketRes,
	CommandLeagueRewardNotSundayPacketRes,
	CommandLeagueRewardSuccessPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import { printTimeBeforeDate } from "../../../../../../Lib/src/utils/TimeUtils";
import { handleCommandLeagueRewardSuccessPacket } from "../../../../commands/player/LeagueRewardCommand";

export default class RespawnCommandPacketHandlers {
	@packetHandler(CommandLeagueRewardNotSundayPacketRes)
	async leagueRewardNotSundayError(context: PacketContext, packet: CommandLeagueRewardNotSundayPacketRes): Promise<void> {
		await handleClassicError(context, "commands:leagueReward.errors.notSunday", {
			nextSunday: printTimeBeforeDate(packet.nextSunday)
		});
	}

	@packetHandler(CommandLeagueRewardNoPointsPacketRes)
	async leagueRewardNoPointsError(context: PacketContext, _packet: CommandLeagueRewardNoPointsPacketRes): Promise<void> {
		await handleClassicError(context, "commands:leagueReward.errors.noPoints");
	}

	@packetHandler(CommandLeagueRewardAlreadyClaimedPacketRes)
	async leagueRewardAlreadyClaimedError(context: PacketContext, _packet: CommandLeagueRewardAlreadyClaimedPacketRes): Promise<void> {
		await handleClassicError(context, "commands:leagueReward.errors.alreadyClaimed");
	}

	@packetHandler(CommandLeagueRewardSuccessPacketRes)
	async leagueRewardSuccess(context: PacketContext, packet: CommandLeagueRewardSuccessPacketRes): Promise<void> {
		await handleCommandLeagueRewardSuccessPacket(packet, context);
	}
}
