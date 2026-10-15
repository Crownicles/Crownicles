import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandAdventureHistoryRes } from "../../../../../Lib/src/packets/commands/CommandAdventureHistoryPacket";
import { secondsToMilliseconds } from "../../../../../Lib/src/utils/TimeUtils";
import { AdventureHistoryRes } from "../../../../../WsPackets/src/fromServer/history/AdventureHistoryRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class AdventureHistoryServerTranslator {
	@fromServerTranslator(CommandAdventureHistoryRes, AdventureHistoryRes)
	public static translate(_context: PacketContext, packet: CommandAdventureHistoryRes): Promise<AdventureHistoryRes> {
		return asyncMakeFromServerPacket(AdventureHistoryRes, {
			available: packet.available,
			entries: packet.entries.map(entry => ({
				...entry, date: secondsToMilliseconds(entry.date)
			})),
			until: secondsToMilliseconds(packet.until),
			windowStartsAt: secondsToMilliseconds(packet.windowStartsAt),
			...packet.nextPage !== undefined ? { nextPage: packet.nextPage } : {}
		});
	}
}
