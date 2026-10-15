import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCityActionReq, CommandReportViewReq
} from "../../../../../Lib/src/packets/commands/CommandReportViewPacket";
import {
	ReportCityActionReq, ReportViewReq
} from "../../../../../WsPackets/src/fromClient/ReportViewReq";

const CITY_ACTION_ID_PATTERN = /^[a-f0-9]{64}$/;

export default class ReportViewClientTranslator {
	@fromClientTranslator(ReportViewReq)
	public static view(_context: PacketContext, _packet: ReportViewReq): Promise<CommandReportViewReq> {
		return asyncMakePacket(CommandReportViewReq, {});
	}

	@fromClientTranslator(ReportCityActionReq)
	public static action(_context: PacketContext, packet: ReportCityActionReq): Promise<CommandReportCityActionReq> {
		if (!Number.isSafeInteger(packet.mapLocationId) || packet.mapLocationId <= 0) {
			throw new InvalidClientPacketError("Invalid city location");
		}
		if (typeof packet.actionId !== "string" || !CITY_ACTION_ID_PATTERN.test(packet.actionId)) {
			throw new InvalidClientPacketError("Invalid city action");
		}
		return asyncMakePacket(CommandReportCityActionReq, {
			mapLocationId: packet.mapLocationId,
			actionId: packet.actionId
		});
	}
}
