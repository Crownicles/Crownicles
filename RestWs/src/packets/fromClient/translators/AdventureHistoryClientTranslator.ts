import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandAdventureHistoryReq } from "../../../../../Lib/src/packets/commands/CommandAdventureHistoryPacket";
import { AdventureHistoryConstants } from "../../../../../Lib/src/constants/AdventureHistoryConstants";
import {
	asMilliseconds, asSeconds, millisecondsToSeconds
} from "../../../../../Lib/src/utils/TimeUtils";
import { AdventureHistoryReq } from "../../../../../WsPackets/src/fromClient/AdventureHistoryReq";

export default class AdventureHistoryClientTranslator {
	@fromClientTranslator(AdventureHistoryReq)
	public static translate(_context: PacketContext, packet: AdventureHistoryReq): Promise<CommandAdventureHistoryReq> {
		if (packet.page !== undefined && (!Number.isInteger(packet.page) || packet.page < 0 || packet.page > AdventureHistoryConstants.MAX_PAGE)) {
			throw new InvalidClientPacketError("Invalid adventure history page");
		}
		if (packet.until !== undefined && (!Number.isSafeInteger(packet.until) || packet.until < 0)) {
			throw new InvalidClientPacketError("Invalid adventure history timestamp");
		}
		return asyncMakePacket(CommandAdventureHistoryReq, {
			...packet.page !== undefined ? { page: packet.page } : {},
			...packet.until !== undefined ? { until: asSeconds(Math.floor(millisecondsToSeconds(asMilliseconds(packet.until)))) } : {}
		});
	}
}
