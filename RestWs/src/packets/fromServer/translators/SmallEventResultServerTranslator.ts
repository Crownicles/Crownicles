import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SmallEventResultData, SmallEventResultRes
} from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";

const NUMBER_RESULT_KEYS = [
	"amount",
	"money",
	"moneyLost",
	"lifeLost",
	"quantity",
	"xp"
] as const;
const STRING_RESULT_KEYS = ["effectId", "materialId"] as const;

function resultData(data: unknown): SmallEventResultData {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return {};
	}
	const source = data as Record<string, unknown>;
	const result: SmallEventResultData = {};
	for (const key of NUMBER_RESULT_KEYS) {
		if (typeof source[key] === "number") {
			Object.assign(result, { [key]: source[key] });
		}
	}
	for (const key of STRING_RESULT_KEYS) {
		if (typeof source[key] === "string") {
			Object.assign(result, { [key]: source[key] });
		}
	}
	return result;
}

export function translateSmallEventResult(eventName: string, data: unknown): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {
		eventName,
		data: resultData(data)
	});
}
