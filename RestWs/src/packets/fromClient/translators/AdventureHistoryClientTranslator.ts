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

function isValidPage(page: number): boolean {
	return Number.isInteger(page) && page >= 0 && page <= AdventureHistoryConstants.MAX_PAGE;
}

function isValidTimestamp(until: number): boolean {
	return Number.isSafeInteger(until) && until >= 0;
}

function assertValidRequest({
	page, until
}: AdventureHistoryReq): void {
	if (page !== undefined && !isValidPage(page)) {
		throw new InvalidClientPacketError("Invalid adventure history page");
	}
	if (until !== undefined && !isValidTimestamp(until)) {
		throw new InvalidClientPacketError("Invalid adventure history timestamp");
	}
}

export default class AdventureHistoryClientTranslator {
	@fromClientTranslator(AdventureHistoryReq)
	public static translate(_context: PacketContext, packet: AdventureHistoryReq): Promise<CommandAdventureHistoryReq> {
		assertValidRequest(packet);
		const {
			page, until
		} = packet;
		return asyncMakePacket(CommandAdventureHistoryReq, {
			...page === undefined ? {} : { page },
			...until === undefined ? {} : { until: asSeconds(Math.floor(millisecondsToSeconds(asMilliseconds(until)))) }
		});
	}
}
