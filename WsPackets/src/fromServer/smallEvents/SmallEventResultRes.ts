import {FromServerPacket} from "../FromServerPacket";

/**
 * A small-event resolution that does not need a dedicated client packet yet.
 *
 * Small events share the same collector lifecycle, but the Core has many event-specific result
 * packets. Keeping the original event name and JSON payload lets the mobile client render the
 * resolution instead of silently dropping it while dedicated designs are added.
 */
export class SmallEventResultRes extends FromServerPacket {
	eventName!: string;

	data!: Record<string, unknown>;
}
