import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBigEventResultRes, CommandReportTravelSummaryRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ReportBigEventResultRes } from "../../../../../WsPackets/src/fromServer/report/ReportBigEventResultRes";
import { ReportTravelSummaryRes } from "../../../../../WsPackets/src/fromServer/report/ReportTravelSummaryRes";

export default class ReportCommandServerTranslator {
	@fromServerTranslator(CommandReportTravelSummaryRes, ReportTravelSummaryRes)
	public static translate(_context: PacketContext, packet: CommandReportTravelSummaryRes): Promise<ReportTravelSummaryRes> {
		return asyncMakeFromServerPacket(ReportTravelSummaryRes, {
			startMap: packet.startMap,
			endMap: packet.endMap,
			startTime: packet.startTime,
			arriveTime: packet.arriveTime,
			nextStopTime: packet.nextStopTime,
			isOnBoat: packet.isOnBoat,
			...packet.effect === undefined ? {} : { effect: packet.effect },
			...packet.effectDuration === undefined ? {} : { effectDuration: packet.effectDuration },
			...packet.effectEndTime === undefined ? {} : { effectEndTime: packet.effectEndTime },
			points: packet.points,
			energy: packet.energy,
			...packet.lastSmallEventId === undefined ? {} : { lastSmallEventId: packet.lastSmallEventId },
			...packet.tokens === undefined ? {} : { tokens: packet.tokens },
			...packet.heal === undefined ? {} : { heal: packet.heal },
			isInCity: packet.isInCity
		});
	}

	@fromServerTranslator(CommandReportBigEventResultRes, ReportBigEventResultRes)
	public static translateBigEventResult(_context: PacketContext, packet: CommandReportBigEventResultRes): Promise<ReportBigEventResultRes> {
		return asyncMakeFromServerPacket(ReportBigEventResultRes, {
			eventId: packet.eventId,
			possibilityId: packet.possibilityId,
			outcomeId: packet.outcomeId,
			score: packet.score,
			experience: packet.experience,
			...packet.effect === undefined ? {} : { effect: packet.effect },
			health: packet.health,
			money: packet.money,
			energy: packet.energy,
			gems: packet.gems,
			tokens: packet.tokens,
			oneshot: packet.oneshot
		});
	}
}
