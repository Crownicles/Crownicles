import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorMessageReaction extends ReactionCollectorReaction {
	emojiId!: string;
}

export class ReactionCollectorMessageRecipientData extends ReactionCollectorData {
	destinationLocationId!: number;
}

export type ReactionCollectorMessageRecipientPacket = ReactionCollectorCreationPacket<
	ReactionCollectorMessageRecipientData,
	ReactionCollectorMessageReaction
>;

export class ReactionCollectorMessageRecipient extends ReactionCollector {
	private readonly reactions: ReactionCollectorMessageReaction[];

	private readonly destinationLocationId: number;

	constructor(destinationLocationId: number, reactions: ReactionCollectorMessageReaction[]) {
		super();
		this.destinationLocationId = destinationLocationId;
		this.reactions = reactions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorMessageRecipientPacket {
		return {
			id,
			endTime,
			reactions: this.reactions.map(reaction => this.buildReaction(ReactionCollectorMessageReaction, reaction)),
			data: this.buildData(ReactionCollectorMessageRecipientData, {
				destinationLocationId: this.destinationLocationId
			})
		};
	}
}
