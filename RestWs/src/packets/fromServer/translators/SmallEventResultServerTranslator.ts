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

function asResultSource(data: unknown): Record<string, unknown> | null {
	if (typeof data !== "object") {
		return null;
	}
	if (data === null) {
		return null;
	}
	if (Array.isArray(data)) {
		return null;
	}
	return data as Record<string, unknown>;
}

function copyPropertiesOfType(
	result: SmallEventResultData,
	source: Record<string, unknown>,
	keys: readonly (keyof SmallEventResultData)[],
	expectedType: "number" | "string"
): void {
	for (const key of keys) {
		if (typeof source[key] === expectedType) {
			Object.assign(result, { [key]: source[key] });
		}
	}
}

function resultData(data: unknown): SmallEventResultData {
	const source = asResultSource(data);
	if (source === null) {
		return {};
	}
	const result: SmallEventResultData = {};
	copyPropertiesOfType(result, source, NUMBER_RESULT_KEYS, "number");
	copyPropertiesOfType(result, source, STRING_RESULT_KEYS, "string");
	return result;
}

export function translateSmallEventResult(eventName: string, data: unknown): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {
		eventName,
		data: resultData(data)
	});
}
