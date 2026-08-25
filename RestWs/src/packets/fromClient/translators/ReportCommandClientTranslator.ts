import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportPacketReq } from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReportReq } from "../../../../../WsPackets/src/fromClient/ReportReq";

export default class ReportCommandClientTranslator {
	@fromClientTranslator(ReportReq)
	public static translate(_context: PacketContext, _packet: ReportReq): Promise<CommandReportPacketReq> {
		return asyncMakePacket(CommandReportPacketReq, {});
	}
}
