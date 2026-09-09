import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { SmallEventResultRes } from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";

/**
 * Fallback used for small-event packets that do not have a dedicated mobile representation yet.
 * Only the fact that the event resolved crosses the wire: the Core payload is keyed by developer
 * field names, so the app could not show it in the player's language.
 */
export function translateSmallEventResult(): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {});
}
