import {packetHandler} from "../../../PacketHandler";
import {
	CommandReportBigEventResultRes,
	CommandReportErrorNoMonsterRes,
	CommandReportMonsterRewardRes,
	CommandReportRefusePveFightRes,
	CommandReportTravelSummaryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import {PacketContext} from "../../../../../../Lib/src/packets/DraftBotPacket";
import {reportResult, reportTravelSummary} from "../../../../commands/player/ReportCommand";

export default class ReportCommandPacketHandlers {
	@packetHandler(CommandReportBigEventResultRes)
	async reportResultRes(context: PacketContext, packet: CommandReportBigEventResultRes): Promise<void> {
		await reportResult(packet, context);
	}

	@packetHandler(CommandReportTravelSummaryRes)
	async reportTravelSummaryRes(context: PacketContext, packet: CommandReportTravelSummaryRes): Promise<void> {
		await reportTravelSummary(packet, context);
	}

	@packetHandler(CommandReportMonsterRewardRes)
	async reportMonsterRewardRes(_context: PacketContext, _packet: CommandReportMonsterRewardRes): Promise<void> {
		// TODO
	}

	@packetHandler(CommandReportErrorNoMonsterRes)
	async reportErrorNoMonsterRes(_context: PacketContext, _packet: CommandReportErrorNoMonsterRes): Promise<void> {
		// TODO
	}

	@packetHandler(CommandReportRefusePveFightRes)
	async reportRefusePveFightRes(_context: PacketContext, _packet: CommandReportRefusePveFightRes): Promise<void> {
		// TODO
	}
}