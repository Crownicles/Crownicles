import { FromClientPacket } from "./FromClientPacket";

/**
 * Answers an open collector by picking one of its choices.
 *
 * The answering player is never carried here: RestWs takes it from the authenticated connection,
 * so a client cannot answer on behalf of somebody else.
 */
export class ReactionCollectorReactReq extends FromClientPacket {
	public collectorId!: string;

	/**
	 * Zero-based position in the `reactions` array of the matching `ReactionCollectorCreation`.
	 */
	public reactionIndex!: number;
}
