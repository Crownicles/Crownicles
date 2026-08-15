import { FromServerPacket } from "../FromServerPacket";

export const COLLECTOR_STOP_REASONS = {
	/**
	 * The countdown ran out. No answer of the player was taken into account.
	 */
	EXPIRED: "expired",

	/**
	 * The interaction ended on its own. A result packet describes what happened.
	 */
	RESOLVED: "resolved"
} as const;

export type CollectorStopReason = typeof COLLECTOR_STOP_REASONS[keyof typeof COLLECTOR_STOP_REASONS];

/**
 * Tells a client that a collector no longer accepts reactions, so its interface can be dismissed
 * instead of waiting forever.
 */
export class ReactionCollectorStop extends FromServerPacket {
	collectorId!: string;

	reason!: CollectorStopReason;
}
