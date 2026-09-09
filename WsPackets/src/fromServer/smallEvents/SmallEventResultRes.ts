import { FromServerPacket } from "../FromServerPacket";

/**
 * Marks a small-event resolution that has no dedicated client packet yet.
 *
 * Small events share the same collector lifecycle, but the Core has many event-specific result
 * packets. Announcing the resolution lets the mobile client close the collector and refresh the
 * report instead of silently dropping it. It carries no detail on purpose: the Core payloads are
 * keyed by developer field names, which no screen can translate. Each event gets its own packet
 * as its design lands.
 */
export class SmallEventResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventResultRes";
}
