import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandAppStateReq } from "../../../../../Lib/src/packets/commands/CommandAppStatePacket";
import { AppStateReq } from "../../../../../WsPackets/src/fromClient/AppStateReq";
import { isAppStateFlag } from "../../../../../WsPackets/src/objects/AppState";

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

export default class AppStateClientTranslator {
	@fromClientTranslator(AppStateReq)
	public static translate(_context: PacketContext, packet: AppStateReq): Promise<CommandAppStateReq> {
		const seen = validList(packet.seen, isAppStateFlag);
		const acknowledged = validList(packet.acknowledged, isWholeNumber);
		return asyncMakePacket(CommandAppStateReq, {
			...seen ? { seen } : {},
			...acknowledged ? { acknowledged } : {}
		});
	}
}
