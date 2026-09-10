import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { SmallEventResultRes } from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";

function resultData(data: unknown): Record<string, unknown> {
	return typeof data === "object" && data !== null && !Array.isArray(data)
		? { ...data }
		: {};
}

export function translateSmallEventResult(eventName: string, data: unknown): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {
		eventName,
		data: resultData(data)
	});
}
