import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

export const REACTION_COLLECTOR_STOP_REASONS = {
	/**
	 * The countdown ran out before the interaction came to an end.
	 */
	EXPIRED: "expired",

	/**
	 * The interaction ended on its own, either answered by the player or closed by the flow owning it.
	 */
	RESOLVED: "resolved"
} as const;

export type ReactionCollectorStopReason = typeof REACTION_COLLECTOR_STOP_REASONS[keyof typeof REACTION_COLLECTOR_STOP_REASONS];

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ReactionCollectorStopPacket extends CrowniclesPacket {
	id!: string;

	reason!: ReactionCollectorStopReason;
}
