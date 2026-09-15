import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealRefusePacketRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	ReportBuyHealAcceptedRes,
	ReportBuyHealCannotHealOccupiedRes,
	ReportBuyHealNoAlterationRes,
	ReportBuyHealRefusedRes
} from "../../../../../WsPackets/src/fromServer/report/ReportHealRes";

/** Translates every terminal state of the report alteration-heal flow for the mobile client. */
export default class ReportHealServerTranslator {
	@fromServerTranslator(CommandReportBuyHealAcceptPacketRes, ReportBuyHealAcceptedRes)
	public static translateAccepted(_context: PacketContext, packet: CommandReportBuyHealAcceptPacketRes): Promise<ReportBuyHealAcceptedRes> {
		return asyncMakeFromServerPacket(ReportBuyHealAcceptedRes, {
			healPrice: packet.healPrice,
			isArrived: packet.isArrived
		});
	}

	@fromServerTranslator(CommandReportBuyHealRefusePacketRes, ReportBuyHealRefusedRes)
	public static translateRefused(_context: PacketContext, _packet: CommandReportBuyHealRefusePacketRes): Promise<ReportBuyHealRefusedRes> {
		return asyncMakeFromServerPacket(ReportBuyHealRefusedRes, {});
	}

	@fromServerTranslator(CommandReportBuyHealNoAlterationPacketRes, ReportBuyHealNoAlterationRes)
	public static translateNoAlteration(_context: PacketContext, _packet: CommandReportBuyHealNoAlterationPacketRes): Promise<ReportBuyHealNoAlterationRes> {
		return asyncMakeFromServerPacket(ReportBuyHealNoAlterationRes, {});
	}

	@fromServerTranslator(CommandReportBuyHealCannotHealOccupiedPacketRes, ReportBuyHealCannotHealOccupiedRes)
	public static translateCannotHealOccupied(_context: PacketContext, _packet: CommandReportBuyHealCannotHealOccupiedPacketRes): Promise<ReportBuyHealCannotHealOccupiedRes> {
		return asyncMakeFromServerPacket(ReportBuyHealCannotHealOccupiedRes, {});
	}
}
