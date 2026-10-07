import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealPacketReq, CommandReportPacketReq, CommandReportUseTokensPacketReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReportReq } from "../../../../../WsPackets/src/fromClient/ReportReq";
import { ReportBuyHealReq } from "../../../../../WsPackets/src/fromClient/ReportBuyHealReq";
import { ReportUseTokensReq } from "../../../../../WsPackets/src/fromClient/ReportUseTokensReq";

export default class ReportCommandClientTranslator {
	@fromClientTranslator(ReportReq)
	public static translate(_context: PacketContext, _packet: ReportReq): Promise<CommandReportPacketReq> {
		return asyncMakePacket(CommandReportPacketReq, {});
	}

	@fromClientTranslator(ReportUseTokensReq)
	public static translateUseTokens(_context: PacketContext, _packet: ReportUseTokensReq): Promise<CommandReportUseTokensPacketReq> {
		return asyncMakePacket(CommandReportUseTokensPacketReq, {});
	}

	@fromClientTranslator(ReportBuyHealReq)
	public static translateBuyHeal(_context: PacketContext, _packet: ReportBuyHealReq): Promise<CommandReportBuyHealPacketReq> {
		return asyncMakePacket(CommandReportBuyHealPacketReq, {});
	}
}
