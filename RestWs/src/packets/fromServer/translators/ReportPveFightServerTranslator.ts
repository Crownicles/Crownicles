import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportErrorNoMonsterRes, CommandReportRefusePveFightRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	ReportPveFightRefusedRes, ReportPveNoMonsterRes
} from "../../../../../WsPackets/src/fromServer/report/ReportPveFightRes";

/** The island boss encounter ends without a fight when the player hides or when no boss can be found. */
export default class ReportPveFightServerTranslator {
	@fromServerTranslator(CommandReportRefusePveFightRes, ReportPveFightRefusedRes)
	public static refused(_context: PacketContext, _packet: CommandReportRefusePveFightRes): Promise<ReportPveFightRefusedRes> {
		return asyncMakeFromServerPacket(ReportPveFightRefusedRes, {});
	}

	@fromServerTranslator(CommandReportErrorNoMonsterRes, ReportPveNoMonsterRes)
	public static noMonster(_context: PacketContext, _packet: CommandReportErrorNoMonsterRes): Promise<ReportPveNoMonsterRes> {
		return asyncMakeFromServerPacket(ReportPveNoMonsterRes, {});
	}
}
