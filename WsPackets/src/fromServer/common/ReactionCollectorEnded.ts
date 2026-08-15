import { FromServerPacket } from "../FromServerPacket";

/**
 * Sent back when a client answers a collector that no longer accepts reactions, because it expired
 * or was already closed. The matching interface must be dismissed rather than left waiting.
 */
export class ReactionCollectorEnded extends FromServerPacket {
}
