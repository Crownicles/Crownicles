import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandDailyBonusPacketReq } from "../../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { DailyBonusReq } from "../../../../../WsPackets/src/fromClient/DailyBonusReq";
import { fromClientTranslator } from "../FromClientTranslator";

export default class DailyBonusCommandClientTranslator {
	@fromClientTranslator(DailyBonusReq)
	public static open(_context: PacketContext, _packet: DailyBonusReq): Promise<CommandDailyBonusPacketReq> {
		return asyncMakePacket(CommandDailyBonusPacketReq, {});
	}
}
