import { FromServerPacket } from "../FromServerPacket";

/** A field of the Core packet, copied as is so the front end can tell the story Discord tells. */
export type SmallEventResultValue = string | number | boolean | null | SmallEventResultValue[] | { [field: string]: SmallEventResultValue };

/**
 * The fields of the Core small-event packet, minus player identifiers, which are replaced by the
 * names they stand for (`playerName`, `ownerName`). Numeric enums are sent by member name.
 */
export type SmallEventResultData = { [field: string]: SmallEventResultValue };

export class SmallEventResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventResultRes";

	eventName!: string;

	data!: SmallEventResultData;
}
