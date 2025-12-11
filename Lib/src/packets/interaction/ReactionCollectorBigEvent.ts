import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorBigEventPossibilityReaction extends ReactionCollectorReaction {
	name!: string;
}

export class ReactionCollectorBigEventData extends ReactionCollectorData {
	eventId!: number;
}

export type ReactionCollectorBigEventPacket = ReactionCollectorCreationPacket<
	ReactionCollectorBigEventData,
	ReactionCollectorBigEventPossibilityReaction
>;

export class ReactionCollectorBigEvent extends ReactionCollector {
	private readonly eventId: number;

	private readonly reactions: ReactionCollectorBigEventPossibilityReaction[];

	constructor(eventId: number, reactions: ReactionCollectorBigEventPossibilityReaction[]) {
		super();
		this.eventId = eventId;
		this.reactions = reactions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorBigEventPacket {
		const reactions = [];
		for (const reaction of this.reactions) {
			reactions.push(this.buildReaction(ReactionCollectorBigEventPossibilityReaction, reaction));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorBigEventData, { eventId: this.eventId })
		};
	}
}
