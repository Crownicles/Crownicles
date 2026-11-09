import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportHomeBedAlreadyFullRes, CommandReportHomeBedRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	HOME_BED_OUTCOMES, HomeBedRes
} from "../../../../../WsPackets/src/fromServer/home/HomeBedRes";

export default class HomeBedServerTranslator {
	@fromServerTranslator(CommandReportHomeBedRes, HomeBedRes)
	public static rested(_context: PacketContext, packet: CommandReportHomeBedRes): Promise<HomeBedRes> {
		return asyncMakeFromServerPacket(HomeBedRes, {
			outcome: {
				type: HOME_BED_OUTCOMES.RESTED, health: packet.health
			}
		});
	}

	@fromServerTranslator(CommandReportHomeBedAlreadyFullRes, HomeBedRes)
	public static alreadyFull(_context: PacketContext, _packet: CommandReportHomeBedAlreadyFullRes): Promise<HomeBedRes> {
		return asyncMakeFromServerPacket(HomeBedRes, { outcome: { type: HOME_BED_OUTCOMES.ALREADY_FULL } });
	}
}
