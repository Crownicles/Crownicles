import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SmallEventResultData, SmallEventResultRes, SmallEventResultValue
} from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import { SmallEventBigBadKind } from "../../../../../Lib/src/types/SmallEventBigBadKind";
import { InteractOtherPlayerInteraction } from "../../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import { resolvePlayerName } from "../PlayerDisplay";
import { BaseMission } from "../../../../../Lib/src/types/CompletedMission";
import { missionData } from "../MissionDisplay";

/** Player identifiers stay on the server: the front end only ever receives the name they stand for. */
const PLAYER_NAME_FIELDS: Record<string, string> = {
	keycloakId: "playerName",
	ownerKeycloakId: "ownerName"
};

const INTERNAL_IDENTIFIER = /keycloakid$/i;

/** Numeric Lib enums travel by member name, so reordering an enum never changes what an installed app reads. */
const ENUM_FIELDS: Record<string, Record<string, Record<number, string>>> = {
	SmallEventBigBadPacket: { kind: SmallEventBigBadKind },
	SmallEventInteractOtherPlayersPacket: { playerInteraction: InteractOtherPlayerInteraction }
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Core objects that already have a WebSocket shape travel in that shape. */
const OBJECT_FIELDS: Record<string, Record<string, (value: Record<string, unknown>) => unknown>> = {
	SmallEventFindMissionPacket: { mission: value => missionData(value as BaseMission) }
};

const SCALAR_TYPES = new Set([
	"string",
	"number",
	"boolean"
]);

function isScalar(value: unknown): value is string | number | boolean | null {
	return value === null || SCALAR_TYPES.has(typeof value);
}

function wireValue(value: unknown): SmallEventResultValue | undefined {
	if (isScalar(value)) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(wireValue).filter((entry): entry is SmallEventResultValue => entry !== undefined);
	}
	return isRecord(value) ? wireObject(value) : undefined;
}

function wireObject(source: Record<string, unknown>): SmallEventResultData {
	const result: SmallEventResultData = {};
	for (const [key, value] of Object.entries(source)) {
		const converted = INTERNAL_IDENTIFIER.test(key) ? undefined : wireValue(value);
		if (converted !== undefined) {
			result[key] = converted;
		}
	}
	return result;
}

function enumNames(eventName: string, source: Record<string, unknown>): SmallEventResultData {
	const names: SmallEventResultData = {};
	for (const [field, members] of Object.entries(ENUM_FIELDS[eventName] ?? {})) {
		const value = source[field];
		if (typeof value === "number" && members[value] !== undefined) {
			names[field] = members[value];
		}
	}
	return names;
}

function objectFields(eventName: string, source: Record<string, unknown>): SmallEventResultData {
	const objects: SmallEventResultData = {};
	for (const [field, convert] of Object.entries(OBJECT_FIELDS[eventName] ?? {})) {
		const value = source[field];
		const converted = isRecord(value) ? wireValue(convert(value)) : undefined;
		if (converted !== undefined) {
			objects[field] = converted;
		}
	}
	return objects;
}

async function playerNames(source: Record<string, unknown>): Promise<SmallEventResultData> {
	const names: SmallEventResultData = {};
	for (const [field, nameField] of Object.entries(PLAYER_NAME_FIELDS)) {
		const keycloakId = source[field];
		const name = typeof keycloakId === "string" ? await resolvePlayerName(keycloakId) : null;
		if (name !== null) {
			names[nameField] = name;
		}
	}
	return names;
}

async function resultData(eventName: string, data: unknown): Promise<SmallEventResultData> {
	if (!isRecord(data)) {
		return {};
	}
	return {
		...wireObject(data),
		...enumNames(eventName, data),
		...objectFields(eventName, data),
		...await playerNames(data)
	};
}

export async function translateSmallEventResult(eventName: string, data: unknown): Promise<SmallEventResultRes> {
	return asyncMakeFromServerPacket(SmallEventResultRes, {
		eventName,
		data: await resultData(eventName, data)
	});
}
