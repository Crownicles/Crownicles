import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportTokenMerchantBoughtRes,
	CommandReportTokenMerchantCannotAffordRes,
	CommandReportTokenMerchantCharityAlreadyUsedRes,
	CommandReportTokenMerchantCharityRes,
	CommandReportTokenMerchantFullRes,
	CommandReportTokenMerchantRefuseRes,
	CommandReportTokenMerchantTooMuchRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensRefusePacketRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	ReportTokenMerchantBoughtRes,
	ReportTokenMerchantCannotAffordRes,
	ReportTokenMerchantCharityAlreadyUsedRes,
	ReportTokenMerchantCharityRes,
	ReportTokenMerchantFullRes,
	ReportTokenMerchantRefusedRes,
	ReportTokenMerchantTooMuchRes,
	ReportUseTokensAcceptedRes,
	ReportUseTokensRefusedRes
} from "../../../../../WsPackets/src/fromServer/report/ReportTokenRes";

/** Translates every terminal state of the report token flow for the mobile client. */
export default class ReportTokenServerTranslator {
	@fromServerTranslator(CommandReportUseTokensAcceptPacketRes, ReportUseTokensAcceptedRes)
	public static translateUseTokensAccepted(_context: PacketContext, packet: CommandReportUseTokensAcceptPacketRes): Promise<ReportUseTokensAcceptedRes> {
		return asyncMakeFromServerPacket(ReportUseTokensAcceptedRes, {
			tokensSpent: packet.tokensSpent,
			isArrived: packet.isArrived
		});
	}

	@fromServerTranslator(CommandReportUseTokensRefusePacketRes, ReportUseTokensRefusedRes)
	public static translateUseTokensRefused(_context: PacketContext, _packet: CommandReportUseTokensRefusePacketRes): Promise<ReportUseTokensRefusedRes> {
		return asyncMakeFromServerPacket(ReportUseTokensRefusedRes, {});
	}

	@fromServerTranslator(CommandReportTokenMerchantBoughtRes, ReportTokenMerchantBoughtRes)
	public static translateMerchantBought(_context: PacketContext, packet: CommandReportTokenMerchantBoughtRes): Promise<ReportTokenMerchantBoughtRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantBoughtRes, { amount: packet.amount });
	}

	@fromServerTranslator(CommandReportTokenMerchantTooMuchRes, ReportTokenMerchantTooMuchRes)
	public static translateMerchantTooMuch(_context: PacketContext, _packet: CommandReportTokenMerchantTooMuchRes): Promise<ReportTokenMerchantTooMuchRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantTooMuchRes, {});
	}

	@fromServerTranslator(CommandReportTokenMerchantFullRes, ReportTokenMerchantFullRes)
	public static translateMerchantFull(_context: PacketContext, _packet: CommandReportTokenMerchantFullRes): Promise<ReportTokenMerchantFullRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantFullRes, {});
	}

	@fromServerTranslator(CommandReportTokenMerchantRefuseRes, ReportTokenMerchantRefusedRes)
	public static translateMerchantRefused(_context: PacketContext, _packet: CommandReportTokenMerchantRefuseRes): Promise<ReportTokenMerchantRefusedRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantRefusedRes, {});
	}

	@fromServerTranslator(CommandReportTokenMerchantCannotAffordRes, ReportTokenMerchantCannotAffordRes)
	public static translateMerchantCannotAfford(_context: PacketContext, _packet: CommandReportTokenMerchantCannotAffordRes): Promise<ReportTokenMerchantCannotAffordRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantCannotAffordRes, {});
	}

	@fromServerTranslator(CommandReportTokenMerchantCharityRes, ReportTokenMerchantCharityRes)
	public static translateMerchantCharity(_context: PacketContext, packet: CommandReportTokenMerchantCharityRes): Promise<ReportTokenMerchantCharityRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantCharityRes, { amount: packet.amount });
	}

	@fromServerTranslator(CommandReportTokenMerchantCharityAlreadyUsedRes, ReportTokenMerchantCharityAlreadyUsedRes)
	public static translateMerchantCharityAlreadyUsed(_context: PacketContext, _packet: CommandReportTokenMerchantCharityAlreadyUsedRes): Promise<ReportTokenMerchantCharityAlreadyUsedRes> {
		return asyncMakeFromServerPacket(ReportTokenMerchantCharityAlreadyUsedRes, {});
	}
}
