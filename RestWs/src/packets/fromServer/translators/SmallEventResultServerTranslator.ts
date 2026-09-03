import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { SmallEventResultRes } from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";

/**
 * Fallback used for small-event packets that do not have a dedicated mobile representation yet.
 * The event-specific Core packet is preserved in the payload so no resolution disappears between
 * the collector stop and the next report refresh.
 */
export function translateSmallEventResult(eventName: string, data: object): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {
		eventName,
		data: data as Record<string, unknown>
	});
}
