import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandAppStateReq } from "../../../../../Lib/src/packets/commands/CommandAppStatePacket";
import { AppStateReq } from "../../../../../WsPackets/src/fromClient/AppStateReq";
import { isAppStateFlag } from "../../../../../WsPackets/src/objects/AppState";
import { Badge } from "../../../../../Lib/src/types/Badge";

function validList<T>(value: unknown, isValid: (entry: unknown) => entry is T): T[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!Array.isArray(value) || !value.every(isValid)) {
		throw new InvalidClientPacketError("Invalid app state change");
	}
	return value;
}

function isWholeNumber(value: unknown): value is number {
	return Number.isInteger(value);
}

const BADGES = new Set<string>(Object.values(Badge));

function isBadge(value: unknown): value is Badge {
	return typeof value === "string" && BADGES.has(value);
}

export default class AppStateClientTranslator {
	@fromClientTranslator(AppStateReq)
	public static translate(_context: PacketContext, packet: AppStateReq): Promise<CommandAppStateReq> {
		const seen = validList(packet.seen, isAppStateFlag);
		const acknowledged = validList(packet.acknowledged, isWholeNumber);
		const revealedBadges = validList(packet.revealedBadges, isBadge);
		return asyncMakePacket(CommandAppStateReq, {
			...seen ? { seen } : {},
			...acknowledged ? { acknowledged } : {},
			...revealedBadges ? { revealedBadges } : {}
		});
	}
}
